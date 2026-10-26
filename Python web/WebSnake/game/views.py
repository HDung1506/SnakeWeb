import json

from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_http_methods

from .models import Score

MAX_SCORES = 5
MAX_POINTS = 10000


def index(request):
    return render(request, "game/index.html")


def top_scores():
    return [
        {"name": s.name, "score": s.score}
        for s in Score.objects.all()[:MAX_SCORES]
    ]


@require_http_methods(["GET", "POST"])
def scores(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body or b"{}")
            value = int(data.get("score", 0))
        except (json.JSONDecodeError, TypeError, ValueError, AttributeError):
            return JsonResponse({"error": "Dữ liệu không hợp lệ"}, status=400)
        if not 0 < value <= MAX_POINTS:
            return JsonResponse({"error": "Điểm không hợp lệ"}, status=400)
        name = str(data.get("name", "")).strip()[:12] or "Ẩn danh"
        Score.objects.create(name=name, score=value)
    return JsonResponse(top_scores(), safe=False)
