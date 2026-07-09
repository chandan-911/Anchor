import datetime
from django.utils import timezone
from anchor_project.gemini import get_embedding, cosine_similarity
from journal.models import JournalEntry
from chat.models import Conversation, Message
from decisions.models import Decision
from swot.models import SWOTReport
from analytics.models import Goal

def retrieve_user_context(user, current_query: str, conversation_id: int = None, limit_semantic: int = 5):
    """
    Retrieves the complete context of a user across different memory layers:
    1. Short-term Memory (Today's journals, recent chat logs)
    2. Long-term Memory (Goals, recent decisions, latest SWOT reports)
    3. Semantic Memory (Vector search on old journals and messages)
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

    # 1. Short-Term Memory
    # Today's journals
    today = datetime.date.today()
    today_journals = JournalEntry.objects.filter(user=user, created_at__date=today)
    for j in today_journals:
        context["short_term"]["today_journals"].append({
            "content": j.content,
            "mood": j.mood_score,
            "confidence": j.confidence_score,
            "stress": j.stress_score,
            "energy": j.energy_level
        })

    # Recent chat logs (last 8 messages from the active conversation)
    if conversation_id:
        recent_messages = Message.objects.filter(
            conversation_id=conversation_id
        ).order_by('-created_at')[:8]
        # Reverse to maintain chronological order
        for m in reversed(recent_messages):
            context["short_term"]["recent_chat"].append({
                "sender": m.sender,
                "content": m.content
            })

    # 2. Long-Term Memory
    # Active goals
    active_goals = Goal.objects.filter(user=user, status='active')[:5]
    for g in active_goals:
        context["long_term"]["active_goals"].append({
            "title": g.title,
            "description": g.description,
            "category": g.category
        })

    # Recent decisions
    recent_decisions = Decision.objects.filter(user=user).order_by('-created_at')[:5]
    for d in recent_decisions:
        context["long_term"]["recent_decisions"].append({
            "title": d.title,
            "status": d.status,
            "recommended": d.recommended_choice,
            "summary": d.summary
        })

    # Latest SWOT report
    latest_swot = SWOTReport.objects.filter(user=user).order_by('-created_at').first()
    if latest_swot:
        context["long_term"]["latest_swot"] = {
            "strengths": latest_swot.strengths,
            "weaknesses": latest_swot.weaknesses,
            "opportunities": latest_swot.opportunities,
            "threats": latest_swot.threats,
            "growth_recommendations": latest_swot.growth_recommendations
        }

    # 3. Semantic Memory (Vector Search)
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
            if similarity > 0.4:  # Threshold
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
            if similarity > 0.4:
                candidates.append((similarity, "chat_message", pm.created_at, pm.content))

        # Sort candidates by similarity descending
        candidates.sort(key=lambda x: x[0], reverse=True)
        
        # Take top-K
        for similarity, source, dt, text in candidates[:limit_semantic]:
            context["semantic_memories"].append({
                "source": source,
                "date": dt.strftime('%Y-%m-%d'),
                "content": text,
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
