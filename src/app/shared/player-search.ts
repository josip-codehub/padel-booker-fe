import { Component, DestroyRef, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { ApiService } from '../core/api.service';
import { PlayerSearchResult } from '../core/models';

/** Debounced name search for people within a club; emits the picked player. */
@Component({
  selector: 'app-player-search',
  imports: [FormsModule],
  templateUrl: './player-search.html',
  styleUrl: './player-search.scss',
})
export class PlayerSearch {
  private api = inject(ApiService);
  private destroyRef = inject(DestroyRef);

  @Input({ required: true }) clubId!: number;
  @Output() picked = new EventEmitter<PlayerSearchResult>();

  query = signal('');
  results = signal<PlayerSearchResult[]>([]);
  searching = signal(false);

  private q$ = new Subject<string>();

  constructor() {
    this.q$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((q) => {
          const term = q.trim();
          if (term.length < 2) {
            this.results.set([]);
            this.searching.set(false);
            return of([] as PlayerSearchResult[]);
          }
          this.searching.set(true);
          return this.api.searchPlayers(this.clubId, term);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (r) => {
          this.results.set(r);
          this.searching.set(false);
        },
        error: () => this.searching.set(false),
      });
  }

  onInput(v: string): void {
    this.query.set(v);
    this.q$.next(v);
  }

  pick(p: PlayerSearchResult): void {
    this.picked.emit(p);
    this.query.set('');
    this.results.set([]);
  }
}
