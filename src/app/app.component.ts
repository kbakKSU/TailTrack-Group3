import { Component } from '@angular/core';
import { ExerciseLogComponent } from './exercise/exercise-log.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ExerciseLogComponent],
  template: `<app-exercise-log></app-exercise-log>`
})
export class AppComponent {}
