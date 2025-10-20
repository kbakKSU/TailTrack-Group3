import { bootstrapApplication } from '@angular/platform-browser';
import { provideServerRendering } from '@angular/platform-server';
import { provideHttpClient } from '@angular/common/http';
import { AppComponent } from './app/app.component';

export default function bootstrap() {
  return bootstrapApplication(AppComponent, {
    providers: [
      provideServerRendering(),
      provideHttpClient() // needed on the server too if your services use HttpClient
    ]
  });
}
