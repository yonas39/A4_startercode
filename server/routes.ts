import { ObjectId } from "mongodb";

import { getExpressRouter, Router } from "./framework/router";

import { Authing, Following, Friending, Posting, Quizing, Sessioning } from "./app";
import { PostOptions } from "./concepts/posting";
import { SessionDoc } from "./concepts/sessioning";
import Responses from "./responses";

import { z } from "zod";

/**
 * Web server routes for the app. Implements synchronizations between concepts.
 */
class Routes {
  // Synchronize the concepts from `app.ts`.

  @Router.get("/session")
  async getSessionUser(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await Authing.getUserById(user);
  }

  @Router.get("/users")
  async getUsers() {
    return await Authing.getUsers();
  }

  @Router.get("/users/:username")
  @Router.validate(z.object({ username: z.string().min(1) }))
  async getUser(username: string) {
    return await Authing.getUserByUsername(username);
  }

  @Router.post("/users")
  async createUser(session: SessionDoc, username: string, password: string) {
    Sessioning.isLoggedOut(session);
    return await Authing.create(username, password);
  }

  @Router.patch("/users/username")
  async updateUsername(session: SessionDoc, username: string) {
    const user = Sessioning.getUser(session);
    return await Authing.updateUsername(user, username);
  }

  @Router.patch("/users/password")
  async updatePassword(session: SessionDoc, currentPassword: string, newPassword: string) {
    const user = Sessioning.getUser(session);
    return Authing.updatePassword(user, currentPassword, newPassword);
  }

  @Router.delete("/users")
  async deleteUser(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    Sessioning.end(session);
    return await Authing.delete(user);
  }

  @Router.post("/login")
  async logIn(session: SessionDoc, username: string, password: string) {
    const u = await Authing.authenticate(username, password);
    Sessioning.start(session, u._id);
    return { msg: "Logged in!" };
  }

  @Router.post("/logout")
  async logOut(session: SessionDoc) {
    Sessioning.end(session);
    return { msg: "Logged out!" };
  }

  @Router.get("/posts")
  @Router.validate(z.object({ author: z.string().optional() }))
  async getPosts(author?: string) {
    let posts;
    if (author) {
      const id = (await Authing.getUserByUsername(author))._id;
      posts = await Posting.getByAuthor(id);
    } else {
      posts = await Posting.getPosts();
    }
    return Responses.posts(posts);
  }

  @Router.post("/posts")
  async createPost(session: SessionDoc, content: string, options?: PostOptions) {
    const user = Sessioning.getUser(session);
    const created = await Posting.create(user, content, options);
    return { msg: created.msg, post: await Responses.post(created.post) };
  }

  @Router.patch("/posts/:id")
  async updatePost(session: SessionDoc, id: string, content?: string, options?: PostOptions) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    await Posting.assertAuthorIsUser(oid, user);
    return await Posting.update(oid, content, options);
  }

  @Router.delete("/posts/:id")
  async deletePost(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    await Posting.assertAuthorIsUser(oid, user);
    return Posting.delete(oid);
  }


  // FRIENDS
  //
  // Friending routes
  //
  @Router.get("/friends")
  async getFriends(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await Authing.idsToUsernames(await Friending.getFriends(user));
  }

  @Router.post("/friend/request")
  async sendFriendRequest(session: SessionDoc, to: string) {
    const user = Sessioning.getUser(session);
    const toOid = (await Authing.getUserByUsername(to))._id;
    return await Friending.sendRequest(user, toOid);
  }

  @Router.put("/friend/accept/:from")
  async acceptFriendRequest(session: SessionDoc, from: string) {
    const user = Sessioning.getUser(session);
    const fromOid = (await Authing.getUserByUsername(from))._id;
    return await Friending.acceptRequest(fromOid, user);
  }

  @Router.put("/friend/reject/:from")
  async rejectFriendRequest(session: SessionDoc, from: string) {
    const user = Sessioning.getUser(session);
    const fromOid = (await Authing.getUserByUsername(from))._id;
    return await Friending.rejectRequest(fromOid, user);
  }

  @Router.delete("/friends/:friend")
  async removeFriend(session: SessionDoc, friend: string) {
    const user = Sessioning.getUser(session);
    const friendOid = (await Authing.getUserByUsername(friend))._id;
    return await Friending.removeFriend(user, friendOid);
  }

  //FOLLOW
  //
  // Follow User
  //
  @Router.post("/follow")
  async followUser(session: SessionDoc, follower: string, following: string) {
    const followerUser = await Authing.getUserByUsername(follower);
    const followingUser = await Authing.getUserByUsername(following);
    return await Following.followUser(followerUser._id, followingUser._id);
  }

  // Unfollow User
  @Router.delete("/follow/:follower/:following")
  async unfollowUser(session: SessionDoc, follower: string, following: string) {
    const followerUser = await Authing.getUserByUsername(follower);
    const followingUser = await Authing.getUserByUsername(following);
    return await Following.unfollowUser(followerUser._id, followingUser._id);
  }

  // Get Followers
  @Router.get("/followers/:user")
  async getFollowers(session: SessionDoc, user: string) {
    const userObj = await Authing.getUserByUsername(user);
    const followers = await Following.getFollowers(userObj._id);
    return {followers};
  }

  // Get Following
  @Router.get("/following/:user")
  async getFollowing(session: SessionDoc, user: string) {
    const userObj = await Authing.getUserByUsername(user);
    const following = await Following.getFollowing(userObj._id);
    return {following};
  }

  // Get Follower Count
  @Router.get("/followers/count/:user")
  async getFollowerCount(session: SessionDoc, user: string) {
    const userObj = await Authing.getUserByUsername(user);
    const count = await Following.getFollowerCount(userObj._id);
    return { followerCount: count };
  }

  // // Get Follow Status
  // @Router.post("/follow/status")
  // async getFollowStatus(session: SessionDoc, follower: string, following: string) {
  //   const followerUser = await Authing.getUserByUsername(follower);
  //   const followingUser = await Authing.getUserByUsername(following);
  //   const status = await Following.isFollowing(followerUser._id, followingUser._id);
  //   return { isFollowing: status };
  // }

  // QUIZ
  //
  // BIBLE QUiz
  //// Bible Quiz Routes

  // @Router.post("/quizzes")
  // async createQuiz(session: SessionDoc, { title, questions }: { title: string; questions: { question: string; options: string[]; answer: string }[] }) {
  //   Sessioning.isLoggedIn(session);
  //   const createdQuiz = await Quizing.createQuiz(title, questions);
  //   return { msg: "Quiz created successfully!", quiz: createdQuiz.quiz };
  // }

  // @Router.patch("/quizzes/:id/publish")
  // async publishQuiz(session: SessionDoc, id: string) {
  //   const quizId = new ObjectId(id);
  //   const updatedQuiz = await Quizing.publishQuiz(quizId);
  //   return { msg: "Quiz published successfully!", quiz: updatedQuiz.quiz };
  // }

  // @Router.post("/quizzes/:id/start")
  // async startQuiz(session: SessionDoc, id: string) {
  //   const quizId = new ObjectId(id);
  //   const user = Sessioning.getUser(session);
  //   const result = await Quizing.startQuiz(quizId, user);
  //   return { msg: "Quiz started successfully!", quizId: result.quizId, playerId: result.playerId };
  // }

  // @Router.post("/quizzes/:id/answer")
  // async answerQuestion(session: SessionDoc, id: string, { questionId, answer }: { questionId: string; answer: string }) {
  //   const quizId = new ObjectId(id);
  //   const questionObjId = new ObjectId(questionId);
  //   const user = Sessioning.getUser(session);
  //   const result = await Quizing.answerQuestion(quizId, user, questionObjId, answer);
  //   return { msg: result.msg, isCorrect: result.isCorrect };
  // }

  // @Router.get("/quizzes/:id/progress")
  // async getPlayerProgress(session: SessionDoc, id: string) {
  //   const quizId = new ObjectId(id);
  //   const user = Sessioning.getUser(session);
  //   const progress = await Quizing.getPlayerProgress(quizId, user);
  //   return { msg: "Player progress fetched!", progress };
  // }

  

  /**
   * Routes for the PrayerMate concept.
   */
  /**
   * Get all prayer groups.
   */
  @Router.get("/prayer-groups")
  async getPrayerGroups() {
    throw new  Error("Not implemented Yet")
  }

  /**
   * Create a new prayer group.
   */
  @Router.post("/prayer-groups")
  async createPrayerGroup() {
    throw new  Error("Not implemented Yet")
  }

  /**
   * Get the details of a specific prayer group by GroupID.
   */
  @Router.get("/prayer-groups/:id")
  async getPrayerGroupById() {
    throw new  Error("Not implemented Yet")
  }

  /**
   * Update a specific prayer group by GroupID.
   */
  @Router.patch("/prayer-groups/:id")
  async updatePrayerGroup() {
    throw new  Error("Not implemented Yet")
  }

  /**
   * Delete a specific prayer group by GroupID.
   */
  @Router.delete("/prayer-groups/:id")
  async deletePrayerGroup() {
    throw new  Error("Not implemented Yet")
  }

  /**
   * Get all events in the calendar.
   */
  @Router.get("/events")
  async getEvents() {
    throw new  Error("Not implemented Yet")
  }

  /**
   * Create a new event in the calendar.
   */
  @Router.post("/events")
  async createEvent() {
    throw new  Error("Not implemented Yet")
  }

  /**
   * Get details of a specific event by EventID.
   */
  @Router.get("/events/:id")
  async getEventById() {
    throw new  Error("Not implemented Yet")
  }

  /**
   * Update a specific event by EventID.
   */
  @Router.patch("/events/:id")
  async updateEvent() {
    throw new  Error("Not implemented Yet")
  }

  /**
   * Delete a specific event by EventID.
   */
  @Router.delete("/events/:id")
  async deleteEvent() {
    throw new  Error("Not implemented Yet")
  }

  // TOUR
  /**
   * Get all tours.
   */
  @Router.get("/tours")
  async getTours() {
    throw new  Error("Not implemented Yet")
  }

  /**
   * Create a new tour.
   */
  @Router.post("/tours")
  async createTour() {
    throw new  Error("Not implemented Yet")
  }

  /**
   * Get details of a specific tour by TourID.
   */
  @Router.get("/tours/:id")
  async getTourById() {
    throw new  Error("Not implemented Yet")
  }

  /**
   * Update a specific tour by TourID.
   */
  @Router.patch("/tours/:id")
  async updateTour() {
    throw new  Error("Not implemented Yet")
  }

  /**
   * Delete a specific tour by TourID.
   */
  @Router.delete("/tours/:id")
  async deleteTour() {
    throw new  Error("Not implemented Yet")
  }

  /**
   * Add a participant to a tour.
   */
  @Router.post("/tours/:id/participants")
  async addParticipant() {
    throw new  Error("Not implemented Yet")
  }

  /**
   * Remove a participant from a tour.
   */
  @Router.delete("/tours/:id/participants/:userId")
  async removeParticipant() {
    throw new  Error("Not implemented Yet")
  }


  // SESSION COUld BE USED WITH TOUR ?????????
  /**
   * Routes for the Session concept.
   */

  /**
   * Get the current active sessions.
   */
  @Router.get("/sessions")
  async getSessions() {
    throw new  Error("Not implemented Yet")
  }

  /**
   * Get the details of a specific session.
   */
  @Router.get("/sessions/:id")
  async getSessionById() {
    throw new  Error("Not implemented Yet")
  }

  /**
   * Start a new session.
   */
  @Router.post("/sessions")
  async startSession() {
    throw new  Error("Not implemented Yet")
  }

  /**
   * End a session.
   */
  @Router.delete("/sessions/:id")
  async endSession() {
    throw new  Error("Not implemented Yet")
  }


}

/** The web app. */
export const app = new Routes();

/** The Express router. */
export const appRouter = getExpressRouter(app);
