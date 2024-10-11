import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

export interface PrayerRequestDoc extends BaseDoc {
  title: string;
  description: string;
  requestor: ObjectId;
  status: "open" | "closed";
  createdAt: Date;
  updatedAt: Date;
}

export interface PrayerResponseDoc extends BaseDoc {
  requestId: ObjectId;
  responder: ObjectId;
  response: string;
  createdAt: Date;
}

/**
 * Concept: PrayerMate [User]
 */

export default class PrayerMateConcept {
  public readonly requests: DocCollection<PrayerRequestDoc>;
  public readonly responses: DocCollection<PrayerResponseDoc>;

  /**
   * Make an instance of PrayerMateConcept.
   */
  constructor(collectionName: string) {
    this.requests = new DocCollection<PrayerRequestDoc>(collectionName + "_requests");
    this.responses = new DocCollection<PrayerResponseDoc>(collectionName + "_responses");
  }

  async createRequest(title: string, description: string, requestor: ObjectId) {
    const requestId = await this.requests.createOne({ title, description, requestor, status: "open", createdAt: new Date(), updatedAt: new Date() });
    return { msg: "Request successfully created!", request: await this.requests.readOne({ _id: requestId }) };
  }

  async getRequests() {
    return await this.requests.readMany({}, { sort: { createdAt: -1 } });
  }

  async getRequest(_id: ObjectId) {
    return await this.requests.readOne({ _id });
  }

  async updateRequest(_id: ObjectId, title?: string, description?: string, status?: "open" | "closed") {
    await this.requests.partialUpdateOne({ _id }, { title, description, status, updatedAt: new Date() });
    return { msg: "Request successfully updated!" };
  }

  async deleteRequest(_id: ObjectId) {
    await this.requests.deleteOne({ _id });
    return { msg: "Request deleted successfully!" };
  }

  async createResponse(requestId: ObjectId, responder: ObjectId, response: string) {
    const responseId = await this.responses.createOne({ requestId, responder, response, createdAt: new Date() });
    return { msg: "Response successfully created!", response: await this.responses.readOne({ _id: responseId }) };
  }

  async getResponses(requestId: ObjectId) {
    return await this.responses.readMany({ requestId });
  }

  async getResponse(_id: ObjectId) {
    return await this.responses.readOne({ _id });
  }

  async updateResponse(_id: ObjectId, response?: string) {
    await this.responses.partialUpdateOne({ _id }, { response });
    return { msg: "Response successfully updated!" };
  }

  async deleteResponse(_id: ObjectId) {
    await this.responses.deleteOne({ _id });
    return { msg: "Response deleted successfully!" };
  }

  async assertRequestorIsUser(_id: ObjectId, user: ObjectId) {
    const request = await this.requests.readOne({ _id });
    if (!request) {
      throw new NotFoundError(`Request ${_id} does not exist!`);
    }
    if (request.requestor.toString() !== user.toString()) {
      throw new NotAllowedError(`User ${user} is not the requestor of request ${_id}`);
    }
  }

  async assertResponderIsUser(_id: ObjectId, user: ObjectId) {
    const response = await this.responses.readOne({ _id });
    if (!response) {
      throw new NotFoundError(`Response ${_id} does not exist!`);
    }
    if (response.responder.toString() !== user.toString()) {
      throw new NotAllowedError(`User ${user} is not the responder of response ${_id}`);
    }
  }

  async assertRequestExists(_id: ObjectId) {
    const request = await this.requests.readOne({ _id });
    if (!request) {
      throw new NotFoundError(`Request ${_id} does not exist!`);
    }
  }

  async assertResponseExists(_id: ObjectId) {
    const response = await this.responses.readOne({ _id });
    if (!response) {
      throw new NotFoundError(`Response ${_id} does not exist!`);
    }
  }
}

export class RequestorNotMatchError extends NotAllowedError {
  constructor(
    public readonly requestor: ObjectId,
    public readonly _id: ObjectId,
  ) {
    super(`User ${requestor} is not the requestor of request ${_id}`);
  }
}

export class ResponderNotMatchError extends NotAllowedError {
  constructor(
    public readonly responder: ObjectId,
    public readonly _id: ObjectId,
  ) {
    super(`User ${responder} is not the responder of response ${_id}`);
  }
}

export class RequestNotFoundError extends NotFoundError {
  constructor(public readonly requestId: ObjectId) {
    super(`Request ${requestId} does not exist!`);
  }
}

export class ResponseNotFoundError extends NotFoundError {
  constructor(public readonly responseId: ObjectId) {
    super(`Response ${responseId} does not exist!`);
  }
}

export class RequestStatusError extends NotAllowedError {
  constructor(
    public readonly requestId: ObjectId,
    public readonly status: "open" | "closed",
  ) {
    super(`Request ${requestId} is not ${status}!`);
  }
}

export class ResponseStatusError extends NotAllowedError {
  constructor(
    public readonly responseId: ObjectId,
    public readonly status: "open" | "closed",
  ) {
    super(`Response ${responseId} is not ${status}!`);
  }
}
