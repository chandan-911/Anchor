import datetime
from django.utils import timezone
from anchor_project.gemini import get_embedding, cosine_similarity
from journal.models import JournalEntry
from chat.models import Conversation, Message
from decisions.models import Decision
from swot.models import SWOTReport
from analytics.models import Goal

def retrieve_user_context(user, current_query: str, conversation_id: int = None, limit_semantic: int = 3):
    """
    Retrieves the complete context of a user across different memory layers,
    optimized with intent-based RAG filters to minimize token usage.
    """
    context = {
        "short_term": {
            "today_journals": [],
            "recent_chat": []
        },
        "long_term": {
            "active_goals": [],
            "recent_decisions": [],
            "latest_swot": None
        },
        "semantic_memories": []
    }

    # Query Intent Detection to prune irrelevant context
    query_lower = current_query.lower()
    
    # Keyword matches
    has_goal_intent = any(w in query_lower for w in ['goal', 'aim', 'plan', 'achieve', 'target', 'future', 'career', 'milestone', 'focus'])
    has_decision_intent = any(w in query_lower for w in ['decide', 'decision', 'choose', 'choice', 'option', 'alternative', 'dilemma', 'select'])
    has_swot_intent = any(w in query_lower for w in ['swot', 'strength', 'weakness', 'opportunity', 'threat', 'risk', 'flaw', 'advantage'])

    # 1. Short-Term Memory
    # Today's journals (always relevant to current day's focus)
    today = datetime.date.today()
    today_journals = JournalEntry.objects.filter(user=user, created_at__date=today)
    for j in today_journals:
        context["short_term"]["today_journals"].append({
            "content": j.content[:200] + '...' if len(j.content) > 200 else j.content, # Truncate content to save tokens
            "mood": j.mood_score,
            "confidence": j.confidence_score,
            "stress": j.stress_score,
            "energy": j.energy_level
        })

    # Recent chat logs (compressed to last 4 messages to save context tokens)
    if conversation_id:
        recent_messages = Message.objects.filter(
            conversation_id=conversation_id
        ).order_by('-created_at')[:4]
        # Reverse to maintain chronological order
        for m in reversed(recent_messages):
            context["short_term"]["recent_chat"].append({
                "sender": m.sender,
                "content": m.content[:250] + '...' if len(m.content) > 250 else m.content
            })

    # 2. Long-Term Memory (Intent-based selective loading)
    # Active goals (load 2 if query is goal-related, else 1 as brief context)
    goal_limit = 2 if has_goal_intent else 1
    active_goals = Goal.objects.filter(user=user, status='active')[:goal_limit]
    for g in active_goals:
        context["long_term"]["active_goals"].append({
            "title": g.title,
            "description": g.description[:150] + '...' if len(g.description) > 150 else g.description,
            "category": g.category
        })

    # Recent decisions (load 2 if query is decision-related, else 1 as brief context)
    decision_limit = 2 if has_decision_intent else 1
    recent_decisions = Decision.objects.filter(user=user).order_by('-created_at')[:decision_limit]
    for d in recent_decisions:
        context["long_term"]["recent_decisions"].append({
            "title": d.title,
            "status": d.status,
            "recommended": d.recommended_choice,
            "summary": d.summary[:150] + '...' if len(d.summary) > 150 else d.summary
        })

    # Latest SWOT report (load only if query has SWOT intent or if no active goals/decisions are present)
    if has_swot_intent or (not active_goals.exists() and not recent_decisions.exists()):
        latest_swot = SWOTReport.objects.filter(user=user).order_by('-created_at').first()
        if latest_swot:
            context["long_term"]["latest_swot"] = {
                "strengths": latest_swot.strengths[:3], # Prune arrays to top 3
                "weaknesses": latest_swot.weaknesses[:3],
                "opportunities": latest_swot.opportunities[:3],
                "threats": latest_swot.threats[:3],
                "growth_recommendations": latest_swot.growth_recommendations[:2]
            }

    # 3. Semantic Memory (Vector Search with tighter thresholds)
    query_vector = get_embedding(current_query)
    if query_vector:
        candidates = []
        
        # Pull candidate journals (older than today)
        past_journals = JournalEntry.objects.filter(
            user=user, 
            created_at__date__lt=today,
            embedding__isnull=False
        )
        for pj in past_journals:
            similarity = cosine_similarity(query_vector, pj.embedding)
            if similarity > 0.55:  # Increased similarity threshold for stricter RAG filtering
                candidates.append((similarity, "journal", pj.created_at, pj.content))

        # Pull candidate chat messages (excluding active conversation's recent ones)
        past_messages = Message.objects.filter(
            conversation__user=user,
            embedding__isnull=False
        )
        if conversation_id:
            past_messages = past_messages.exclude(conversation_id=conversation_id)

        for pm in past_messages:
            similarity = cosine_similarity(query_vector, pm.embedding)
            if similarity > 0.55: # Stricter relevance threshold
                candidates.append((similarity, "chat_message", pm.created_at, pm.content))

        # Sort candidates by similarity descending
        candidates.sort(key=lambda x: x[0], reverse=True)
        
        # Take top-K (pruned to limit_semantic)
        for similarity, source, dt, text in candidates[:limit_semantic]:
            context["semantic_memories"].append({
                "source": source,
                "date": dt.strftime('%Y-%m-%d'),
                "content": text[:200] + '...' if len(text) > 200 else text, # Truncate past text to save tokens
                "similarity": round(similarity, 3)
            })

    return context

def format_context_prompt(context):
    """
    Format user context database details into an descriptive instruction prompt for Gemini.
    """
    prompt_sections = []

    # 1. Short Term - Today's Journal & Current Chat
    if context["short_term"]["today_journals"]:
        prompt_sections.append("### User's Reflections Today:")
        for idx, j in enumerate(context["short_term"]["today_journals"]):
            prompt_sections.append(
                f"{idx+1}. Content: {j['content']} (Mood: {j['mood']}/10, Confidence: {j['confidence']}/10, Stress: {j['stress']}/10, Energy: {j['energy']}/10)"
            )
    
    # 2. Long Term - Goals
    if context["long_term"]["active_goals"]:
        prompt_sections.append("\n### Active Goals:")
        for idx, g in enumerate(context["long_term"]["active_goals"]):
            prompt_sections.append(f"- {g['title']} ({g['category']}): {g['description']}")

    # 3. Long Term - Decisions
    if context["long_term"]["recent_decisions"]:
        prompt_sections.append("\n### Recent Decisions & Dilemmas:")
        for idx, d in enumerate(context["long_term"]["recent_decisions"]):
            prompt_sections.append(
                f"- Decision: {d['title']} | Status: {d['status']} | Summary: {d['summary']} | Recommendation: {d['recommended']}"
            )

    # 4. Long Term - Latest SWOT
    swot = context["long_term"]["latest_swot"]
    if swot:
        prompt_sections.append("\n### Latest SWOT Analysis Insights:")
        prompt_sections.append(f"- Strengths: {', '.join(swot['strengths'][:5])}")
        prompt_sections.append(f"- Weaknesses: {', '.join(swot['weaknesses'][:5])}")
        prompt_sections.append(f"- Opportunities: {', '.join(swot['opportunities'][:5])}")
        prompt_sections.append(f"- Threats: {', '.join(swot['threats'][:5])}")
        prompt_sections.append(f"- Growth Recommendations: {', '.join(swot['growth_recommendations'][:3])}")

    # 5. Semantic Memory - relevant past journals/chats
    if context["semantic_memories"]:
        prompt_sections.append("\n### Relevant Past Memories & Concerns:")
        for m in context["semantic_memories"]:
            prompt_sections.append(
                f"- [{m['source'].upper()} - {m['date']}]: \"{m['content']}\" (relevance: {m['similarity']})"
            )

    return "\n".join(prompt_sections)
