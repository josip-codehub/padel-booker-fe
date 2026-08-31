import { Component, inject } from '@angular/core';
import { ConfirmService } from '../core/confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  imports: [],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
})
export class ConfirmDialog {
  protected svc = inject(ConfirmService);

  ok(): void {
    this.svc.respond(true);
  }

  cancel(): void {
    this.svc.respond(false);
  }
}
