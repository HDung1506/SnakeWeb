from django.db import models


class Score(models.Model):
    name = models.CharField("Tên", max_length=12)
    score = models.PositiveIntegerField("Điểm")
    created_at = models.DateTimeField("Thời gian", auto_now_add=True)

    class Meta:
        ordering = ["-score", "created_at"]

    def __str__(self):
        return f"{self.name}: {self.score}"
