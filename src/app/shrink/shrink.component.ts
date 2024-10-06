import { Component, OnInit } from '@angular/core';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { Router, ActivatedRoute } from '@angular/router';
import heic2any from 'heic2any';
import { Employee } from '../models/employee';
import { AuthService } from '../services/auth.service';
import { ComputationService } from '../services/computation.service';
import { DataService } from '../services/data.service';
import { PerformanceService } from '../services/performance.service';
import { TimeService } from '../services/time.service';

@Component({
  selector: 'app-shrink',
  templateUrl: './shrink.component.html',
  styleUrls: ['./shrink.component.css'],
})
export class ShrinkComponent {}
