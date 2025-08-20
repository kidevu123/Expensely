from __future__ import annotations
from django.contrib.auth import get_user_model
from django.db import models

User = get_user_model()


class TimestampedModel(models.Model):
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		abstract = True


class Company(TimestampedModel):
	label = models.CharField(max_length=100, unique=True)
	color = models.CharField(max_length=24, default="#6b7280")

	def __str__(self) -> str:
		return self.label


class Show(TimestampedModel):
	name = models.CharField(max_length=200)
	address = models.CharField(max_length=300, blank=True)
	booth_number = models.CharField(max_length=50, blank=True)
	is_closed = models.BooleanField(default=False)
	whatsapp_group_name = models.CharField(max_length=150, blank=True)
	whatsapp_invite_link = models.URLField(blank=True)

	def __str__(self) -> str:
		return self.name


class Participant(TimestampedModel):
	show = models.ForeignKey(Show, on_delete=models.CASCADE, related_name="participants")
	user = models.ForeignKey(User, on_delete=models.CASCADE)
	airline = models.CharField(max_length=100, blank=True)
	flight_conf = models.CharField(max_length=100, blank=True)
	hotel_name = models.CharField(max_length=150, blank=True)
	hotel_conf = models.CharField(max_length=100, blank=True)
	hotel_address = models.CharField(max_length=300, blank=True)
	car_company = models.CharField(max_length=150, blank=True)
	car_conf = models.CharField(max_length=100, blank=True)
	car_pickup_address = models.CharField(max_length=300, blank=True)

	def __str__(self) -> str:
		return f"{self.user} @ {self.show}"


class Expense(TimestampedModel):
	TYPE_CHOICES = (
		("daily", "Daily"),
		("show", "Show"),
	)

	status = models.CharField(max_length=40, default="unassigned")
	type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="daily")
	show = models.ForeignKey(Show, on_delete=models.SET_NULL, null=True, blank=True)
	description = models.CharField(max_length=300, blank=True)
	amount_cents = models.IntegerField(default=0)
	category = models.CharField(max_length=80, blank=True)
	last4 = models.CharField(max_length=4, blank=True)
	company = models.ForeignKey(Company, on_delete=models.SET_NULL, null=True, blank=True)
	file_id = models.CharField(max_length=120, blank=True)
	file_url = models.URLField(blank=True)
	cost_id = models.CharField(max_length=120, blank=True)  # mirror linkage
	uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

	def __str__(self) -> str:
		return f"{self.description or 'Expense'} {self.amount_cents/100:.2f}"


class CardMap(TimestampedModel):
	last4 = models.CharField(max_length=4, unique=True)
	company = models.ForeignKey(Company, on_delete=models.CASCADE)

	def __str__(self) -> str:
		return f"{self.last4} -> {self.company.label}"


class Feedback(TimestampedModel):
	reporter = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
	content = models.TextField()
	resolved = models.BooleanField(default=False)
	file_id = models.CharField(max_length=120, blank=True)
	file_url = models.URLField(blank=True)
	github_issue_number = models.IntegerField(null=True, blank=True)

	def __str__(self) -> str:
		return f"Feedback #{self.pk}"


class Audit(TimestampedModel):
	action = models.CharField(max_length=100)
	actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
	metadata = models.JSONField(default=dict, blank=True)

	def __str__(self) -> str:
		return f"{self.created_at} {self.action}"