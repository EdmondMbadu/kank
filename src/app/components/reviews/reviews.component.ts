import { Component, OnInit } from '@angular/core';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { Router } from '@angular/router';
import { Comment } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';

@Component({
  selector: 'app-reviews',
  templateUrl: './reviews.component.html',
  styleUrls: ['./reviews.component.css'],
})
export class ReviewsComponent implements OnInit {
  personPostingComment?: string = '';
  numberofStars: string = '';
  comment?: string = '';
  reviews: Comment[] = [];

  constructor(
    private router: Router,
    public auth: AuthService,
    private storage: AngularFireStorage,
    private data: DataService,
    public time: TimeService,
    private compute: ComputationService
  ) {}

  ngOnInit(): void {
    // Ensure user is available before fetching reviews

    this.auth.getReviews().subscribe((data: any) => {
      this.reviews = data[0].reviews;
      // console.log('reviews', this.reviews);
      this.setReviews();
    });
  }

  setReviews() {
    if (this.reviews) {
      // add the formatted time
      this.reviews.forEach((comment) => {
        comment.timeFormatted = this.time.convertDateToDesiredFormat(
          comment.time!
        );
        comment.starsNumber = Number(comment.stars);
      });
    }
    this.reviews.sort((a: any, b: any) => {
      const parseTime = (time: string) => {
        const [month, day, year, hour, minute, second] = time
          .split('-')
          .map(Number);
        return new Date(year, month - 1, day, hour, minute, second).getTime();
      };

      const dateA = parseTime(a.time);
      const dateB = parseTime(b.time);
      return dateB - dateA; // Descending order
    });
  }
  addReview() {
    if (
      this.comment === '' ||
      this.personPostingComment === '' ||
      this.numberofStars === ''
    ) {
      alert('Remplissez toutes les données.');
      return;
    }

    const confirmation = confirm(
      `Êtes-vous sûr de vouloir publier ce commentaire`
    );
    if (!confirmation) {
      return;
    }

    try {
      const review = {
        name: this.personPostingComment,
        comment: this.comment,
        time: this.time.todaysDate(),
        stars: this.numberofStars,
      };

      this.auth.addReview(review).then(() => {
        this.personPostingComment = '';
        this.comment = '';
        this.numberofStars = '';
      });
    } catch (error) {
      alert(
        "Une erreur s'est produite lors de la publication du commentaire. Essayez à nouveau."
      );
    }
  }
}
