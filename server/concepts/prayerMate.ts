import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

// Define interfaces for the PrayerMate documents
export interface PrayerGroupDoc extends BaseDoc {
  leader: ObjectId;
  members: ObjectId[];
  title: string;
  topic: string;
}

export interface PrayerSessionDoc extends BaseDoc {
  groupID: ObjectId;
  startTime: Date;
  endTime?: Date;
  active: boolean;
}

// PrayerMate class to manage groups and sessions
export default class PrayerMate {
  public readonly groups: DocCollection<PrayerGroupDoc>;
  public readonly sessions: DocCollection<PrayerSessionDoc>;

  constructor(collectionName: string) {
    this.groups = new DocCollection<PrayerGroupDoc>(collectionName + "_groups");
    this.sessions = new DocCollection<PrayerSessionDoc>(collectionName + "_sessions");
  }

  // Create a new prayer group
  async createPrayerGroup(leader: ObjectId, title: string, topic: string) {
    const group = await this.groups.createOne({
      leader,
      members: [leader],
      title,
      topic,
    });
    return group;
  }

  // Join a prayer group
  async joinPrayerGroup(user: ObjectId, groupID: ObjectId) {
    // Convert groupID to BSON-compatible ObjectId
    const group = await this.groups.readOne({ _id: new ObjectId(groupID) });
    if (!group) {
      throw new PrayerGroupNotFoundError(groupID);
    }
    if (group.members.some((member) => member.equals(user))) {
      throw new UserAlreadyInGroupError(user, groupID);
    }

    // Ensure all members are ObjectId instances, including the new user
    group.members.push(new ObjectId(user));

    // Update group with the correct ObjectId for groupID and members array
    await this.groups.partialUpdateOne(
      { _id: new ObjectId(groupID) },
      {
        members: group.members,
      },
    );

    return { msg: `User ${user} has joined the group ${groupID}.` };
  }

  // Start a prayer session for a group
  async startPrayerSession(groupID: ObjectId) {
    const group = await this.groups.readOne({ _id: groupID });
    if (!group) {
      throw new PrayerGroupNotFoundError(groupID);
    }
    const activeSession = await this.sessions.readOne({ groupID, active: true });
    if (activeSession) {
      throw new ActiveSessionAlreadyExistsError(groupID);
    }

    const session = await this.sessions.createOne({
      groupID,
      startTime: new Date(),
      active: true,
    });
    return { msg: "Prayer session started!", session };
  }

  // End a prayer session
  async endPrayerSession(groupID: ObjectId) {
    // Convert groupID to BSON-compatible ObjectId
    const session = await this.sessions.readOne({ groupID: new ObjectId(groupID), active: true });
    if (!session) {
      throw new NoActiveSessionError(groupID);
    }

    // Update the session with correct ObjectId for session._id and set active to false
    await this.sessions.partialUpdateOne({ _id: new ObjectId(session._id) }, { active: false, endTime: new Date() });

    return { msg: "Prayer session ended." };
  }

  // Leave a prayer group
  async leavePrayerGroup(user: ObjectId, groupID: ObjectId) {
    // Ensure groupID is a proper BSON ObjectId
    const group = await this.groups.readOne({ _id: new ObjectId(groupID) });
    if (!group) {
      throw new PrayerGroupNotFoundError(groupID);
    }

    // Check if the user is part of the group
    if (!group.members.some((member) => member.equals(new ObjectId(user)))) {
      throw new UserNotInGroupError(user, groupID);
    }

    // Remove the user from the members array, ensuring ObjectId compatibility
    group.members = group.members.filter((member) => !member.equals(new ObjectId(user)));

    // Update the group with the updated members list
    await this.groups.partialUpdateOne({ _id: new ObjectId(groupID) }, { members: group.members, dateUpdated: new Date() });

    return { msg: `User ${user} has left the group ${groupID}.` };
  }

  // Get group members
  async getGroupMembers(groupID: ObjectId): Promise<ObjectId[]> {
    const group = await this.groups.readOne({ _id: groupID });
    if (!group) {
      throw new PrayerGroupNotFoundError(groupID);
    }
    return group.members;
  }

  // Fetch all active prayer sessions
  async getAllActiveSessions() {
    const activeSessions = await this.sessions.readMany({ active: true });
    return activeSessions;
  }

  // Get active prayer session
  async getActiveSession(groupID: ObjectId) {
    const session = await this.sessions.readOne({ groupID, active: true });
    if (!session) {
      throw new NoActiveSessionError(groupID);
    }
    return session;
  }

  // Get a prayer group by ID
  async getPrayerGroup(groupID: ObjectId) {
    const group = await this.groups.readOne({ _id: groupID });
    if (!group) {
      throw new PrayerGroupNotFoundError(groupID);
    }
    return group;
  }

  async getSessionById(sessionID: ObjectId) {
    const session = await this.sessions.readOne({ _id: sessionID });
    if (!session) {
      throw new NoActiveSessionError(sessionID);
    }
    return session;
  }
}

// Custom error classes
class PrayerGroupNotFoundError extends NotFoundError {
  constructor(groupID: ObjectId) {
    super(`Prayer group with ID ${groupID} does not exist.`);
  }
}

class UserAlreadyInGroupError extends NotAllowedError {
  constructor(user: ObjectId, groupID: ObjectId) {
    super(`User ${user} is already a member of group ${groupID}.`);
  }
}

class UserNotInGroupError extends NotAllowedError {
  constructor(user: ObjectId, groupID: ObjectId) {
    super(`User ${user} is not a member of group ${groupID}.`);
  }
}

class ActiveSessionAlreadyExistsError extends NotAllowedError {
  constructor(groupID: ObjectId) {
    super(`There is already an active session for group ${groupID}.`);
  }
}

class NoActiveSessionError extends NotFoundError {
  constructor(groupID: ObjectId) {
    super(`No active session found for group ${groupID}.`);
  }
}
