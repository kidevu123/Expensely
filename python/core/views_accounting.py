from __future__ import annotations
from django.contrib.auth.decorators import login_required
from django.db.models import Prefetch
from django.shortcuts import render, redirect
from django.urls import reverse
from .models import Expense, Company


@login_required
def accounting(request):
	companies = list(Company.objects.all())
	unassigned = Expense.objects.filter(company__isnull=True).order_by('-created_at')
	by_company = {c.id: [] for c in companies}
	for e in Expense.objects.select_related('company').order_by('-created_at'):
		if e.company:
			by_company[e.company_id].append(e)
	context = {
		"companies": companies,
		"by_company": by_company,
		"unassigned": unassigned,
	}
	return render(request, "accounting.html", context)


@login_required
def unassign(request, expense_id: int):
	Expense.objects.filter(id=expense_id).update(company=None, status='unassigned')
	return redirect(reverse('accounting'))