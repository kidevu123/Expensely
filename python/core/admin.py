from django.contrib import admin
from .models import Company, Show, Participant, Expense, CardMap, Feedback, Audit


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
	list_display = ("id", "label", "color", "created_at")
	search_fields = ("label",)


@admin.register(Show)
class ShowAdmin(admin.ModelAdmin):
	list_display = ("id", "name", "is_closed", "created_at")
	list_filter = ("is_closed",)
	search_fields = ("name",)


@admin.register(Participant)
class ParticipantAdmin(admin.ModelAdmin):
	list_display = ("id", "show", "user", "airline", "hotel_name", "car_company")
	list_filter = ("show",)
	search_fields = ("user__username", "user__email")


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
	list_display = ("id", "type", "show", "description", "amount_cents", "category", "last4", "company", "status", "created_at")
	list_filter = ("type", "status", "company", "show")
	search_fields = ("description", "last4")


@admin.register(CardMap)
class CardMapAdmin(admin.ModelAdmin):
	list_display = ("last4", "company", "created_at")
	search_fields = ("last4",)


@admin.register(Feedback)
class FeedbackAdmin(admin.ModelAdmin):
	list_display = ("id", "reporter", "resolved", "created_at")
	list_filter = ("resolved",)
	search_fields = ("content",)


@admin.register(Audit)
class AuditAdmin(admin.ModelAdmin):
	list_display = ("id", "action", "actor", "created_at")
	search_fields = ("action",)