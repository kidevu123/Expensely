from django.contrib import admin
from django.http import JsonResponse
from django.urls import path
import os

from .views import home


def health(_request):
	return JsonResponse({"ok": True, "service": "expensely-python", "version": os.environ.get("APP_VERSION", "dev")})


urlpatterns = [
	path("", home, name="home"),
	path("admin/", admin.site.urls),
	path("api/health", health),
]