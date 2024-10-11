import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

interface EventCalendarDoc extends BaseDoc {
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  location: string;
  attendees: ObjectId[];
}

interface EventAttendeeDoc extends BaseDoc {
  eventId: ObjectId;
  attendee: ObjectId;
  status: "going" | "not going" | "maybe";
}

/**
 * concept: Eventing [User]
 */
export default class EventingConcept {
  public readonly events: DocCollection<EventCalendarDoc>;
  public readonly attendees: DocCollection<EventAttendeeDoc>;

  /**
   * Make an instance of Eventing.
   */
  constructor(collectionName: string) {
    this.events = new DocCollection<EventCalendarDoc>(collectionName + "_events");
    this.attendees = new DocCollection<EventAttendeeDoc>(collectionName + "_attendees");
  }

  async createEvent(title: string, description: string, startDate: Date, endDate: Date, location: string, attendees: ObjectId[]) {
    const eventId = await this.events.createOne({ title, description, startDate, endDate, location, attendees });
    return { msg: "Event successfully created!", event: await this.events.readOne({ _id: eventId }) };
  }

  async getEvents() {
    return await this.events.readMany({}, { sort: { startDate: 1 } });
  }

  async getEvent(_id: ObjectId) {
    return await this.events.readOne({ _id });
  }

  async updateEvent(_id: ObjectId, title?: string, description?: string, startDate?: Date, endDate?: Date, location?: string, attendees?: ObjectId[]) {
    await this.events.partialUpdateOne({ _id }, { title, description, startDate, endDate, location, attendees });
    return { msg: "Event successfully updated!" };
  }

  async deleteEvent(_id: ObjectId) {
    await this.events.deleteOne({ _id });
    return { msg: "Event deleted successfully!" };
  }

  async getAttendees(eventId: ObjectId) {
    const attendees = await this.attendees.readMany({ eventId });
    return attendees.map((attendee) => attendee.attendee);
  }

  async getEventAttendee(eventId: ObjectId, attendee: ObjectId) {
    return await this.attendees.readOne({ eventId, attendee });
  }

  async addAttendee(eventId: ObjectId, attendee: ObjectId) {
    await this.attendees.createOne({ eventId, attendee, status: "going" });
    return { msg: "Attendee added!" };
  }

  async removeAttendee(eventId: ObjectId, attendee: ObjectId) {
    await this.attendees.deleteOne({ eventId, attendee });
    return { msg: "Attendee removed!" };
  }

  async updateAttendeeStatus(eventId: ObjectId, attendee: ObjectId, status: "going" | "not going" | "maybe") {
    await this.attendees.partialUpdateOne({ eventId, attendee }, { status });
    return { msg: "Attendee status updated!" };
  }

  async assertEventExists(_id: ObjectId) {
    const event = await this.events.readOne({ _id });
    if (!event) {
      throw new NotFoundError(`Event ${_id} does not exist!`);
    }
  }

  async assertAttendeeExists(eventId: ObjectId, attendee: ObjectId) {
    const attendeeDoc = await this.attendees.readOne({ eventId, attendee });
    if (!attendeeDoc) {
      throw new NotFoundError(`Attendee ${attendee} does not exist for event ${eventId}!`);
    }
  }

  async assertAttendeeIsUser(eventId: ObjectId, attendee: ObjectId) {
    const attendeeDoc = await this.attendees.readOne({ eventId, attendee });
    if (!attendeeDoc) {
      throw new NotFoundError(`Attendee ${attendee} does not exist for event ${eventId}!`);
    }
  }

  async assertAttendeeStatus(eventId: ObjectId, attendee: ObjectId, status: "going" | "not going" | "maybe") {
    const attendeeDoc = await this.attendees.readOne({ eventId, attendee });
    if (!attendeeDoc || attendeeDoc.status !== status) {
      throw new NotAllowedError(`Attendee ${attendee} is not ${status} for event ${eventId}!`);
    }
  }
}

export class EventNotFoundError extends NotFoundError {
  constructor(public readonly eventId: ObjectId) {
    super(`Event ${eventId} does not exist!`);
  }
}

export class AttendeeNotFoundError extends NotFoundError {
  constructor(
    public readonly eventId: ObjectId,
    public readonly attendee: ObjectId,
  ) {
    super(`Attendee ${attendee} does not exist for event ${eventId}!`);
  }
}

export class AttendeeNotMatchError extends NotAllowedError {
  constructor(
    public readonly eventId: ObjectId,
    public readonly attendee: ObjectId,
  ) {
    super(`Attendee ${attendee} is not the user for event ${eventId}!`);
  }
}

export class AttendeeStatusError extends NotAllowedError {
  constructor(
    public readonly eventId: ObjectId,
    public readonly attendee: ObjectId,
    public readonly status: "going" | "not going" | "maybe",
  ) {
    super(`Attendee ${attendee} is not ${status} for event ${eventId}!`);
  }
}
