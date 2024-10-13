import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

interface PilgrimageTourDoc extends BaseDoc {
  title: string;
  description: string;
  availableDates: Date[];
  location: string;
  participants: ObjectId[];
}

interface UserTourParticipationDoc extends BaseDoc {
  tourId: ObjectId;
  user: ObjectId;
}

/**
 * concept: PilgrimageTouring
 * Purpose: Offer users immersive virtual tours of significant Orthodox Christian sites.
 */
export default class PilgrimageTouringConcept {
  public readonly tours: DocCollection<PilgrimageTourDoc>;
  public readonly userParticipation: DocCollection<UserTourParticipationDoc>;

  /**
   * Make an instance of PilgrimageTouring.
   */
  constructor(collectionName: string) {
    this.tours = new DocCollection<PilgrimageTourDoc>(collectionName + "_tours");
    this.userParticipation = new DocCollection<UserTourParticipationDoc>(collectionName + "_userParticipation");
  }

  // Method to create a pilgrimage tour
  // async createPilgrimageTour(title: string, description: string, availableDates: string[], location: string) {
  //   // Convert availableDates (array of strings) into actual Date objects
  //   const parsedDates = availableDates.map((dateString) => new Date(dateString));

  //   const tourId = await this.tours.createOne({ title, description, availableDates: parsedDates, location, participants: [] });
  //   return { msg: "Pilgrimage tour successfully created!", tour: await this.tours.readOne({ _id: tourId }) };
  // }
  async createPilgrimageTour(title: string, description: string, location: string) {
    const tourId = await this.tours.createOne({
      title,
      description,
      location,
      participants: [],
    });

    return { msg: "Pilgrimage tour successfully created!", tour: await this.tours.readOne({ _id: tourId }) };
  }

  // async createPilgrimageTour(title: string, description: string, availableDates: string | string[], location: string) {
  //   let parsedDates: Date[];

  //   // Handle empty dates, single date, or array of dates
  //   if (!availableDates) {
  //     parsedDates = []; // No dates provided
  //   } else if (typeof availableDates === "string") {
  //     parsedDates = [new Date(availableDates)]; // Single date provided
  //   } else {
  //     parsedDates = availableDates.map((dateString) => new Date(dateString)); // Array of dates provided
  //   }

  //   const tourId = await this.tours.createOne({
  //     title,
  //     description,
  //     availableDates: parsedDates,
  //     location,
  //     participants: [],
  //   });

  //   return { msg: "Pilgrimage tour successfully created!", tour: await this.tours.readOne({ _id: tourId }) };
  // }

  // Start a tour
  async startTour(user: ObjectId, tourID: ObjectId) {
    await this.assertTourExists(tourID);
    const existingParticipation = await this.userParticipation.readOne({ user, tourId: tourID });

    if (existingParticipation) {
      throw new NotAllowedError(`User ${user} is already participating in the tour ${tourID}`);
    }

    await this.userParticipation.createOne({ user, tourId: tourID });
    await this.tours.collection.updateOne({ _id: tourID }, { $push: { participants: user } });

    return { msg: "Tour started!", tour: await this.tours.readOne({ _id: tourID }) };
  }

  // // Join a group tour
  // async joinGroupTour(user: ObjectId, tourID: ObjectId) {
  //   await this.assertTourExists(tourID);
  //   const userTour = await this.userParticipation.readOne({ user, tourId: tourID });

  //   if (!userTour) {
  //     throw new NotAllowedError(`User ${user} is not participating in the tour ${tourID}`);
  //   }

  //   return { msg: "Joined group tour!" };
  // }
  // Join a group tour
  async joinGroupTour(user: ObjectId, tourID: ObjectId) {
    await this.assertTourExists(tourID);

    const tour = await this.tours.readOne({ _id: tourID });

    // Ensure user is not already in the participants list
    if (!tour) {
      throw new NotFoundError(`Tour ${tourID} does not exist.`);
    }
    const isParticipant = tour.participants.some((participantId) => participantId.equals(user));

    if (isParticipant) {
      throw new NotAllowedError(`User ${user} is already a participant in the tour ${tourID}`);
    }

    await this.tours.collection.updateOne({ _id: tourID }, { $push: { participants: user } });

    return { msg: "Joined group tour!", tour: await this.tours.readOne({ _id: tourID }) };
  }

  // View tour details
  async viewTourDetails(tourID: ObjectId) {
    await this.assertTourExists(tourID);
    const tourDetails = await this.tours.readOne({ _id: tourID });
    return tourDetails;
  }

  async leaveTour(user: ObjectId, tourID: ObjectId) {
    await this.assertTourExists(tourID);

    const tour = await this.tours.readOne({ _id: tourID });

    // Correctly compare ObjectIds in the participants list
    if (!tour) {
      throw new NotFoundError(`Tour ${tourID} does not exist.`);
    }
    const isParticipant = tour.participants.some((participantId) => participantId.equals(user));

    if (!isParticipant) {
      throw new NotAllowedError(`User ${user} is not a participant in the tour ${tourID}`);
    }

    await this.tours.collection.updateOne({ _id: tourID }, { $pull: { participants: user } });

    return { msg: "Tour left successfully!", tour: await this.tours.readOne({ _id: tourID }) };
  }

  // Helper Methods
  private async assertTourExists(_id: ObjectId) {
    const tour = await this.tours.readOne({ _id });
    if (!tour) {
      throw new TourNotFoundError(_id);
    }
  }

  private async assertUserParticipation(user: ObjectId, tourID: ObjectId) {
    const participation = await this.userParticipation.readOne({ user, tourId: tourID });
    if (!participation) {
      throw new NotAllowedError(`User ${user} is not participating in the tour ${tourID}`);
    }
  }
}

export class TourNotFoundError extends NotFoundError {
  constructor(public readonly tourId: ObjectId) {
    super(`Tour ${tourId} does not exist!`);
  }
}
