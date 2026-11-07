"""Generic rules used when an occupation's content does not supply its own.

They match the capability traits every occupation's seed data already uses
(``ai_fluency``, ``judgement``, ``technical_depth``, ``human_connection``,
``adaptability``, ``learning_mindset``) and the three pathways. They carry no
evidence links, so they output learning activities only.
"""

from __future__ import annotations

from typing import Any


def _activity(rule_id: str, priority: int, when: dict[str, Any], title: str, description: str, reason: str) -> dict[str, Any]:
    return {
        "id": rule_id,
        "priority": priority,
        "when": when,
        "output": {"category": "learning_activity", "title": title, "description": description},
        "reason": reason,
        "evidence_ids": [],
    }


DEFAULT_RULES: list[dict[str, Any]] = [
    _activity(
        "default-adapt-deepen", 10, {"pathway": "adapt"},
        "Keep a log of where AI helps and where it fails in your work",
        "For a month, note each task where an AI tool saved time and each time you had to correct it.",
        "Adapt is your leading pathway, and knowing exactly where tools help is the next step in your current role.",
    ),
    _activity(
        "default-transform-project", 10, {"pathway": "transform"},
        "Run one small project that changes how a task is done",
        "Pick a task your team repeats every week and test a new way of doing it with an AI tool, then share what you learned.",
        "Transform is your leading pathway, and redesigning work is best learned by trying it on a real task.",
    ),
    _activity(
        "default-discover-explore", 10, {"pathway": "discover"},
        "Talk to two people in the field you are curious about",
        "Arrange short conversations with people already working in the adjacent role and ask what their first year looked like.",
        "Discover is your leading pathway, and conversations are a low-cost way to test a new direction.",
    ),
    _activity(
        "default-ai-fluency", 20, {"tag": "ai_fluency"},
        "Practise checking AI output against a trusted source",
        "Take three AI-generated answers from your field and verify each one, noting what was wrong or missing.",
        "You chose options that build AI fluency, and checking output is the core of using AI tools responsibly.",
    ),
    _activity(
        "default-judgement", 20, {"tag": "judgement"},
        "Write down the reasoning behind one difficult decision",
        "After your next hard call at work, write a short note on what you weighed and what you would do differently.",
        "Your choices relied on professional judgement, which grows fastest when you reflect on real decisions.",
    ),
    _activity(
        "default-technical-depth", 20, {"tag": "technical_depth"},
        "Complete one hands-on technical tutorial end to end",
        "Choose a free, practical tutorial related to your choices and finish it, including the exercises.",
        "Several of your choices needed technical depth, which is built by doing rather than reading.",
    ),
    _activity(
        "default-human-connection", 20, {"tag": "human_connection"},
        "Ask for feedback on how you handle a difficult conversation",
        "After a tense conversation with a customer, colleague or student, ask a trusted colleague how it came across.",
        "You chose options that depend on working with people, a skill that improves with honest feedback.",
    ),
    _activity(
        "default-adaptability", 20, {"tag": "adaptability"},
        "Volunteer for the next new tool or process at work",
        "When your team next changes a tool or process, offer to try it first and report back on what works.",
        "Your choices showed a willingness to adapt, and early adopters learn the most from change.",
    ),
    _activity(
        "default-learning-mindset", 20, {"tag": "learning_mindset"},
        "Set a 30-day learning goal",
        "Choose one specific skill from this report and plan 20 minutes of practice a day for the next month.",
        "Your choices favoured learning something new, and a short, specific goal makes it stick.",
    ),
]
