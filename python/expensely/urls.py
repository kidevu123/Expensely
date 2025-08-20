from django.contrib import admin
from django.http import JsonResponse
from django.urls import path
import os

from .views import home
from core.views import upload
from core.views_accounting import accounting, unassign


def health(_request):
	return JsonResponse({"ok": True, "service": "expensely-python", "version": os.environ.get("APP_VERSION", "dev")})


urlpatterns = [
	path("", home, name="home"),
	path("upload", upload, name="upload"),
	path("accounting", accounting, name="accounting"),
	path("accounting/unassign/<int:expense_id>", unassign, name="unassign"),
	path("admin/", admin.site.urls),
	path("api/health", health),
]