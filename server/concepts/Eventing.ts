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
    await this.assertEventExists(_id);
    return await this.events.readOne({ _id });
  }

  async updateEvent(_id: ObjectId, title?: string, description?: string, startDate?: Date, endDate?: Date, location?: string, attendees?: ObjectId[]) {
    await this.assertEventExists(_id);
    await this.events.partialUpdateOne({ _id }, { title, description, startDate, endDate, location, attendees });
    return { msg: "Event successfully updated!" };
  }

  async deleteEvent(_id: ObjectId) {
    await this.assertEventExists(_id);
    await this.events.deleteOne({ _id });
    return { msg: "Event deleted successfully!" };
  }

  async getEventAttendees(eventId: ObjectId) {
    await this.assertEventExists(eventId);
    const attendees = await this.attendees.readMany({ eventId });
    return attendees.map((attendee) => attendee.attendee);
  }

  async addAttendee(eventId: ObjectId, attendee: ObjectId) {
    await this.assertEventExists(eventId);
    await this.attendees.createOne({ eventId, attendee, status: "going" });
    return { msg: "Attendee added!" };
  }

  async removeAttendee(eventId: ObjectId, attendee: ObjectId) {
    await this.assertAttendeeExists(eventId, attendee);
    await this.attendees.deleteOne({ eventId, attendee });
    return { msg: "Attendee removed!" };
  }

  async updateAttendeeStatus(eventId: ObjectId, attendee: ObjectId, status: "going" | "not going" | "maybe") {
    await this.assertAttendeeExists(eventId, attendee);
    await this.attendees.partialUpdateOne({ eventId, attendee }, { status });
    return { msg: "Attendee status updated!" };
  }

  async getAttendees(eventId: ObjectId) {
    const attendees = await this.attendees.readMany({ eventId });
    return attendees.map((attendee) => attendee.attendee);
  }

  // Helper Methods

  private async assertEventExists(_id: ObjectId) {
    const event = await this.events.readOne({ _id });
    if (!event) {
      throw new EventNotFoundError(_id);
    }
  }

  private async assertAttendeeExists(eventId: ObjectId, attendee: ObjectId) {
    const attendeeDoc = await this.attendees.readOne({ eventId, attendee });
    if (!attendeeDoc) {
      throw new AttendeeNotFoundError(eventId, attendee);
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
