import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormBuilder, Validators, AbstractControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Exercise, ExerciseService } from './exercise.service';

// --- Custom validators (mirrors lab style) ---
function positiveNumber(c: AbstractControl) {
  const v = Number(c.value);
  return (isNaN(v) || v < 0) ? { positive: true } : null;
}
function minDuration(min: number) {
  return (c: AbstractControl) => {
    const v = Number(c.value);
    return (isNaN(v) || v < min) ? { minDuration: { min } } : null;
  };
}

@Component({
  selector: 'app-exercise-log',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule], // required
  templateUrl: './exercise-log.component.html',
  styleUrls: ['./exercise-log.component.css']
})
export class ExerciseLogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(ExerciseService);

  // For M1, hardcode pet; later wire to Pet Profile selection
  petId = 'demo-pet-1';

  activities: Exercise['activityType'][] = ['Walk','Run','Play','Park','Frisbee','Swim','Hike','Training','Other'];
  unit: 'Miles' | 'Kilometers' = 'Miles';

  // UI state (lab pattern using signals)
  items = signal<Exercise[]>([]);
  loading = signal(false);
  errorMsg = signal<string | null>(null);
  successMsg = signal<string | null>(null);
  isEditing = signal(false);
  editingId = signal<string | null>(null);

  // Reactive Form (from labs 5–7 patterns)
  form = this.fb.group({
    dateTime: [new Date().toISOString().slice(0,16), Validators.required], // yyyy-MM-ddTHH:mm
    activityType: ['Walk', Validators.required],
    durationMinutes: [30, [Validators.required, minDuration(1), positiveNumber]],
    distance: [0, [positiveNumber]],
    notes: ['']
  });

  // Derived UI: pace (min/km or min/mi)
  pace = computed(() => {
    const dur = Number(this.form.value.durationMinutes || 0);
    const dist = Number(this.form.value.distance || 0);
    if (!dur || !dist) return '';
    const minPerUnit = dur / dist;
    return `${minPerUnit.toFixed(1)} min/${this.unit}`;
  });

  // Weekly totals (read/history requirement)
  weeklyTotals = computed(() => {
    const now = new Date();
    const start = new Date(); start.setDate(now.getDate() - 6); // last 7 days
    const inWindow = this.items().filter(x => {
      const d = new Date(x.date);
      return d >= new Date(start.toDateString()) && d <= now;
    });
    const totalMin = inWindow.reduce((s, x) => s + Number(x.durationMinutes || 0), 0);
    const totalKm = inWindow.reduce((s, x) => s + Number(x.distanceMiles || 0), 0);
    return { count: inWindow.length, totalMin, totalKm, totalMi: totalKm * 0.621371 };
  });

  ngOnInit() {
    // Dynamic validators based on activity (like zip-code lab event binding)
    this.form.controls.activityType.valueChanges.subscribe(type => {
      const distanceCtrl = this.form.controls.distance;
      if (type === 'Walk' || type === 'Run' || type === 'Hike' || type === 'Bike' as any) {
        distanceCtrl.addValidators([positiveNumber]);
      } else {
        // distance optional for Play/Park/Frisbee/etc.
        distanceCtrl.clearValidators();
        distanceCtrl.addValidators([positiveNumber]);
      }
      distanceCtrl.updateValueAndValidity({ emitEvent: false });
    });

    this.refresh();
  }

  refresh() {
    this.loading.set(true);
    this.api.list(this.petId).subscribe({
      next: data => { this.items.set(data); this.loading.set(false); },
      error: err => { this.errorMsg.set(err.message || 'Load failed'); this.loading.set(false); }
    });
  }

  submit() {
  this.errorMsg.set(null);
  this.successMsg.set(null);

  if (this.form.invalid) {
    this.form.markAllAsTouched();
    return;
  }

  const rawDistance = Number(this.form.value.distance || 0);
  const distanceMiles =
    this.unit === 'Miles'
      ? rawDistance
      : rawDistance / 1.60934; // convert km -> miles

  const payload: Exercise = {
    petId: this.petId,
    date: this.form.value.dateTime!, // ISO string from datetime-local
    activityType: this.form.value.activityType as Exercise['activityType'],
    durationMinutes: Number(this.form.value.durationMinutes),
    distanceMiles, // <-- always miles in the API
    notes: this.form.value.notes || ''
  };

  if (!this.isEditing()) {
    this.api.create(payload).subscribe({
      next: () => { this.successMsg.set('Exercise saved.'); this.resetForm(); this.refresh(); },
      error: err => this.errorMsg.set(err.error?.error || err.message || 'Save failed')
    });
  } else {
    const id = this.editingId();
    if (!id) return;
    this.api.update(id, payload).subscribe({
      next: () => { this.successMsg.set('Exercise updated.'); this.cancelEdit(); this.refresh(); },
      error: err => this.errorMsg.set(err.error?.error || err.message || 'Update failed')
    });
  }
}

  edit(item: Exercise) {
    this.isEditing.set(true);
    this.editingId.set(item._id!);

    // set unit switch to km (stored); convert to current UI unit
const distMiles = Number(item.distanceMiles || 0);
const uiDist = (this.unit === 'Miles') ? distMiles : distMiles * 1.60934;

this.form.patchValue({
  // ... other fields
  distance: Number(uiDist.toFixed(2)),
});

    // datetime-local expects yyyy-MM-ddTHH:mm
    const dt = new Date(item.date);
    const isoShort = new Date(dt.getTime() - dt.getTimezoneOffset()*60000).toISOString().slice(0,16);

    this.form.patchValue({
      dateTime: isoShort,
      activityType: item.activityType,
      durationMinutes: item.durationMinutes,
      distance: Number(uiDist.toFixed(2)),
      notes: item.notes || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit() {
    this.isEditing.set(false);
    this.editingId.set(null);
    this.resetForm();
  }

  resetForm() {
    this.form.reset({
      dateTime: new Date().toISOString().slice(0,16),
      activityType: 'Walk',
      durationMinutes: 30,
      distance: 0,
      notes: ''
    });
  }

  delete(id?: string) {
    if (!id) return;
    if (!confirm('Delete this exercise entry?')) return;
    this.api.remove(id).subscribe({
      next: () => this.refresh(),
      error: err => this.errorMsg.set(err.error?.error || err.message || 'Delete failed')
    });
  }
toggleUnit() {
  const v = Number(this.form.value.distance || 0);

  if (this.unit === 'Miles') {
    // convert miles → km
    this.unit = 'Kilometers';
    this.form.patchValue({ distance: Number((v * 1.60934).toFixed(2)) });
  } else {
    // convert km → miles
    this.unit = 'Miles';
    this.form.patchValue({ distance: Number((v / 1.60934).toFixed(2)) });
  }
}


  // helpers for template validation messages
  get f() { return this.form.controls; }
}
