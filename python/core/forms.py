from __future__ import annotations
from django import forms
from django.contrib.auth import get_user_model
from .models import Expense, Show


class ExpenseCreateForm(forms.Form):
	type = forms.ChoiceField(choices=Expense.TYPE_CHOICES)
	show = forms.ModelChoiceField(queryset=Show.objects.all(), required=False)
	description = forms.CharField(max_length=300, required=False)
	amount = forms.DecimalField(max_digits=10, decimal_places=2)
	category = forms.CharField(max_length=80, required=False)
	last4 = forms.CharField(max_length=4, required=False)
	receipt = forms.FileField(required=False)

	def clean_last4(self):
		val = self.cleaned_data.get("last4", "").strip()
		if val and (len(val) != 4 or not val.isdigit()):
			raise forms.ValidationError("Enter last 4 digits")
		return val

	def clean(self):
		cleaned = super().clean()
		type_ = cleaned.get("type")
		show = cleaned.get("show")
		if type_ == "show" and not show:
			raise forms.ValidationError("Select a show for show expenses")
		if show and show.is_closed:
			raise forms.ValidationError("Selected show is closed for submissions")
		return cleaned