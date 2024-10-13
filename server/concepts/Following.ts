import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

NotAllowedError;
NotFoundError;
export interface FollowDoc extends BaseDoc {
  follower: ObjectId; // The user who is following
  following: ObjectId; // The user who is followed
  status: "active" | "blocked"; //Status of the following
}

export default class FollowConcept {
  [x: string]: any;
  public readonly follows: DocCollection<FollowDoc>;

  /**
   * Make an instance of FollowConcept.
   */
  constructor(collectionName: string) {
    this.follows = new DocCollection<FollowDoc>(collectionName);
  }

  /**
   * Get a list of followers for a given user.
   */
  async getFollowers(user: ObjectId): Promise<ObjectId[]> {
    const followers = await this.follows.readMany({
      // $or: [{ user1: user }, { user2: user }],
      $or: [{ follower: user }, { following: user }],
      // following: user,
      status: "active",
    });
    return followers.map((follow) => follow.follower);
  }

  /**
   * Get a list of users that a given user is following.
   */
  async getFollowing(user: ObjectId): Promise<ObjectId[]> {
    const following = await this.follows.readMany({
      follower: user,
      status: "active",
    });
    return following.map((follow) => follow.following);
  }

  /**
   * Follow a user.
   */
  async followUser(follower: ObjectId, following: ObjectId) {
    await this.assertNotBlocked(follower, following);
    await this.assertNotFollowing(follower, following);
    await this.follows.createOne({ follower, following, status: "active" });
    return { msg: `User ${follower} is now following ${following}.` };
  }

  /**
   * Unfollow a user.
   */
  async unfollowUser(follower: ObjectId, following: ObjectId) {
    const followDoc = await this.removeFollowing(follower, following);
    if (followDoc === null) {
      throw new FollowNotFoundError(follower, following);
    }
    return { msg: `User ${follower} has unfollowed ${following}.` };
  }

  /**
   * Block a user from following.
   */
  async blockUser(follower: ObjectId, following: ObjectId) {
    await this.removeFollowing(follower, following);
    await this.follows.createOne({ follower, following, status: "blocked" });
    return { msg: `User ${follower} is now blocked from following ${following}.` };
  }

  /**
   * Get the count of followers for a given user.
   */
  async getFollowerCount(user: ObjectId): Promise<number> {
    const count = await this.follows.count({
      following: user,
      status: "active",
    });
    return count;
  }

  /**
   * Get the follow status between two users.
   */
  async getFollowStatus(follower: ObjectId, following: ObjectId): Promise<string | null> {
    const follow = await this.follows.readOne({
      follower,
      following,
    });
    return follow ? follow.status : null;
  }

  // Helper Private Functions
  private async removeFollowing(follower: ObjectId, following: ObjectId) {
    return await this.follows.popOne({
      follower,
      following,
    });
  }

  private async assertNotFollowing(follower: ObjectId, following: ObjectId) {
    const follow = await this.follows.readOne({ follower, following, status: "active" });
    if (follow !== null || follower.toString() === following.toString()) {
      throw new AlreadyFollowingError(follower, following);
    }
  }

  private async assertNotBlocked(follower: ObjectId, following: ObjectId) {
    const follow = await this.follows.readOne({ follower, following, status: "blocked" });
    if (follow !== null) {
      throw new UserBlockedError(follower, following);
    }
  }
}

// Custom Error Messages designed for the follow concept
export class FollowNotFoundError extends NotFoundError {
  constructor(
    public readonly follower: ObjectId,
    public readonly following: ObjectId,
  ) {
    super(`Following relationship from user ${follower} to user ${following} does not exist!`);
  }
}

export class AlreadyFollowingError extends NotAllowedError {
  constructor(
    public readonly follower: ObjectId,
    public readonly following: ObjectId,
  ) {
    super(`User ${follower} is already following user ${following}.`);
  }
}

export class UserBlockedError extends NotAllowedError {
  constructor(
    public readonly follower: ObjectId,
    public readonly following: ObjectId,
  ) {
    super(`User ${follower} is blocked from following user ${following}.`);
  }
}
