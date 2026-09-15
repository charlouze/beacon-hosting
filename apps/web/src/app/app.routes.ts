import { Routes } from '@angular/router';
import { JoinRoute } from './join/join.route';
import { WorldRoute } from './worlds/world.route';
import { WorldsRoute } from './worlds/worlds.route';

export const routes: Routes = [
  { path: '', component: WorldsRoute },
  { path: 'worlds/:worldId', component: WorldRoute },
  { path: 'join/:worldId/:code', component: JoinRoute },
  { path: '**', redirectTo: '' },
];
