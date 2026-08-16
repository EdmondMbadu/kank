# Kank

This is a microfinance monitoring application for a local small business.
It has the full information of clients and the summary of daily activities as well as the life cycle information. 

Serveless application developped in angular and Google Cloud. 

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Release safety

Run `npm run test:stability` before releasing. It verifies the production build and the critical registration, new-cycle, payment, budget, Storage-permission, and SMS paths.

Storage rules are tested against the local Firebase Firestore and Storage emulators. `firebase deploy --only storage` also runs those rules tests automatically and stops the deployment if a critical upload or access rule is broken.


# Kank
