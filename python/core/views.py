from __future__ import annotations
from decimal import Decimal
from django.contrib.auth.decorators import login_required
from django.core.files.storage import default_storage
from django.shortcuts import render, redirect
from django.urls import reverse
from .forms import ExpenseCreateForm
from .models import Expense, CardMap, Company


@login_required
def upload(request):
	context = {}
	if request.method == "POST":
		form = ExpenseCreateForm(request.POST, request.FILES)
		if form.is_valid():
			cd = form.cleaned_data
			amount_cents = int(Decimal(cd["amount"]) * 100)
			file_id = ""
			file_url = ""
			if request.FILES.get("receipt"):
				f = request.FILES["receipt"]
				path = default_storage.save(f"receipts/{f.name}", f)
				file_url = request.build_absolute_uri(default_storage.url(path))
				rel_id = path.split("/")[-1]
				file_id = rel_id

			company = None
			if cd.get("last4"):
				mapping = CardMap.objects.filter(last4=cd["last4"]).select_related("company").first()
				if mapping:
					company = mapping.company

			exp = Expense.objects.create(
				status="assigned" if company else "unassigned",
				type=cd["type"],
				show=cd.get("show"),
				description=cd.get("description", ""),
				amount_cents=amount_cents,
				category=cd.get("category", ""),
				last4=cd.get("last4", ""),
				company=company,
				file_id=file_id,
				file_url=file_url,
				uploaded_by=request.user,
			)

			return redirect(reverse("upload") + f"?ok=1&id={exp.id}")
		else:
			context["errors"] = form.errors
	else:
		form = ExpenseCreateForm()

	context["form"] = form
	return render(request, "upload.html", context)