from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

	initial = True

	dependencies = [
		migrations.swappable_dependency(settings.AUTH_USER_MODEL),
	]

	operations = [
		migrations.CreateModel(
			name='Company',
			fields=[
				('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
				('created_at', models.DateTimeField(auto_now_add=True)),
				('updated_at', models.DateTimeField(auto_now=True)),
				('label', models.CharField(max_length=100, unique=True)),
				('color', models.CharField(default='#6b7280', max_length=24)),
			],
		),
		migrations.CreateModel(
			name='Show',
			fields=[
				('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
				('created_at', models.DateTimeField(auto_now_add=True)),
				('updated_at', models.DateTimeField(auto_now=True)),
				('name', models.CharField(max_length=200)),
				('address', models.CharField(blank=True, max_length=300)),
				('booth_number', models.CharField(blank=True, max_length=50)),
				('is_closed', models.BooleanField(default=False)),
				('whatsapp_group_name', models.CharField(blank=True, max_length=150)),
				('whatsapp_invite_link', models.URLField(blank=True)),
			],
		),
		migrations.CreateModel(
			name='CardMap',
			fields=[
				('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
				('created_at', models.DateTimeField(auto_now_add=True)),
				('updated_at', models.DateTimeField(auto_now=True)),
				('last4', models.CharField(max_length=4, unique=True)),
				('company', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='core.company')),
			],
		),
		migrations.CreateModel(
			name='Expense',
			fields=[
				('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
				('created_at', models.DateTimeField(auto_now_add=True)),
				('updated_at', models.DateTimeField(auto_now=True)),
				('status', models.CharField(default='unassigned', max_length=40)),
				('type', models.CharField(choices=[('daily', 'Daily'), ('show', 'Show')], default='daily', max_length=20)),
				('description', models.CharField(blank=True, max_length=300)),
				('amount_cents', models.IntegerField(default=0)),
				('category', models.CharField(blank=True, max_length=80)),
				('last4', models.CharField(blank=True, max_length=4)),
				('file_id', models.CharField(blank=True, max_length=120)),
				('file_url', models.URLField(blank=True)),
				('cost_id', models.CharField(blank=True, max_length=120)),
				('company', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='core.company')),
				('show', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='core.show')),
				('uploaded_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
			],
		),
		migrations.CreateModel(
			name='Participant',
			fields=[
				('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
				('created_at', models.DateTimeField(auto_now_add=True)),
				('updated_at', models.DateTimeField(auto_now=True)),
				('airline', models.CharField(blank=True, max_length=100)),
				('flight_conf', models.CharField(blank=True, max_length=100)),
				('hotel_name', models.CharField(blank=True, max_length=150)),
				('hotel_conf', models.CharField(blank=True, max_length=100)),
				('hotel_address', models.CharField(blank=True, max_length=300)),
				('car_company', models.CharField(blank=True, max_length=150)),
				('car_conf', models.CharField(blank=True, max_length=100)),
				('car_pickup_address', models.CharField(blank=True, max_length=300)),
				('show', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='participants', to='core.show')),
				('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
			],
		),
		migrations.CreateModel(
			name='Feedback',
			fields=[
				('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
				('created_at', models.DateTimeField(auto_now_add=True)),
				('updated_at', models.DateTimeField(auto_now=True)),
				('content', models.TextField()),
				('resolved', models.BooleanField(default=False)),
				('file_id', models.CharField(blank=True, max_length=120)),
				('file_url', models.URLField(blank=True)),
				('github_issue_number', models.IntegerField(blank=True, null=True)),
				('reporter', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
			],
		),
		migrations.CreateModel(
			name='Audit',
			fields=[
				('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
				('created_at', models.DateTimeField(auto_now_add=True)),
				('updated_at', models.DateTimeField(auto_now=True)),
				('action', models.CharField(max_length=100)),
				('metadata', models.JSONField(blank=True, default=dict)),
				('actor', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
			],
		),
	]