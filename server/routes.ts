import { ObjectId } from "mongodb";

import { getExpressRouter, Router } from "./framework/router";

import { Authing, Eventing, Following, Friending, Posting, prayerMate, Quizing, Sessioning, Touring } from "./app";
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

  //FOLLOWING
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
    return { followers };
  }

  // Get Following
  @Router.get("/following/:user")
  async getFollowing(session: SessionDoc, user: string) {
    const userObj = await Authing.getUserByUsername(user);
    const following = await Following.getFollowing(userObj._id);
    return { following };
  }

  // Get Follower Count
  @Router.get("/followers/count/:user")
  async getFollowerCount(session: SessionDoc, user: string) {
    const userObj = await Authing.getUserByUsername(user);
    const count = await Following.getFollowerCount(userObj._id);
    return { followerCount: count };
  }

  // Get Follow Status
  @Router.post("/follow/status")
  async getFollowStatus(session: SessionDoc, follower: string, following: string) {
    const followerUser = await Authing.getUserByUsername(follower);
    const followingUser = await Authing.getUserByUsername(following);
    const status = await Following.getFollowStatus(followerUser._id, followingUser._id);
    return { isFollowing: status };
  }

  // // BIBLE QUIZ
  // // BibleQuiz routes
  // @Router.post("/quizzes")
  // async createQuiz(session: SessionDoc, title: string, questions: { questionText: string; options: string[]; correctAnswer: string }[]) {
  //   const user = Sessioning.getUser(session);
  //   // const creator = user._id;

  //   const quizQuestions = questions.map((q, index) => ({
  //     questionID: index + 1,
  //     questionText: q.questionText,
  //     options: q.options,
  //     correctAnswer: q.correctAnswer,
  //   }));

  //   return await Quizing.createQuiz(title, quizQuestions, user);
  // }

  // @Router.post("/quizzes/:quizID/start")
  // async startQuiz(session: SessionDoc, quizID: string) {
  //   const user = Sessioning.getUser(session);
  //   return await Quizing.startQuiz(user, new ObjectId(quizID));
  // }

  // @Router.post("/quizzes/:quizID/answer/:questionID")
  // async answerQuestion(session: SessionDoc, quizID: string, questionID: string, selectedOption: string) {
  //   const user = Sessioning.getUser(session);
  //   return await Quizing.answerQuestion(user, new ObjectId(quizID), Number(questionID), selectedOption);
  // }

  // @Router.get("/quizzes/:quizID/progress")
  // async getPlayerProgress(session: SessionDoc, quizID: string) {
  //   const user = Sessioning.getUser(session);
  //   return await Quizing.getPlayerProgress(new ObjectId(quizID), user);
  // }

  // @Router.get("/quizzes/:quizID/leaderboard")
  // async viewQuizLeaderboard(session: SessionDoc, quizID: string) {
  //   return await Quizing.viewQuizLeaderboard(new ObjectId(quizID));
  // }
  // BIBLE QUIZ
  // BibleQuiz routes
  // @Router.post("/quizzes")
  // async createQuiz(session: SessionDoc, title: string, questions: { questionText: string; correctAnswer: string }[]) {
  //   const user = Sessioning.getUser(session);

  //   const quizQuestions = questions.map((q, index) => ({
  //     questionID: index + 1, // Auto-increment the question ID
  //     questionText: q.questionText,
  //     correctAnswer: q.correctAnswer, // No options, just the correct answer
  //   }));

  //   return await Quizing.createQuiz(title, quizQuestions, user); // Use user as the creator
  // }
  @Router.post("/quizzes")
  async createQuiz(session: SessionDoc, title: string, questions: any) {
    const user = Sessioning.getUser(session);

    // Check if 'questions' is already an array or a string
    let quizQuestions;
    if (typeof questions === "string") {
      // Try parsing it if it's a string (this could happen if questions are sent as a JSON string)
      try {
        quizQuestions = JSON.parse(questions);
      } catch (e) {
        return { msg: "Invalid format for questions. It must be a valid JSON array." };
      }
    } else if (Array.isArray(questions)) {
      quizQuestions = questions;
    } else {
      return { msg: "Questions must be an array or a valid JSON string." };
    }

    // Now ensure that each question has the required structure
    quizQuestions = quizQuestions.map((q: { questionText: string; correctAnswer: string }, index: number) => {
      if (!q.questionText || !q.correctAnswer) {
        throw new Error("Each question must have 'questionText' and 'correctAnswer'");
      }
      return {
        questionID: index + 1,
        questionText: q.questionText,
        correctAnswer: q.correctAnswer,
      };
    });

    return await Quizing.createQuiz(title, quizQuestions, user); // Use user._id as the creator
  }

  @Router.post("/quizzes/:quizID/start")
  async startQuiz(session: SessionDoc, quizID: string) {
    const user = Sessioning.getUser(session);
    return await Quizing.startQuiz(user, new ObjectId(quizID)); // Use user
  }

  @Router.post("/quizzes/:quizID/answer/:questionID")
  async answerQuestion(session: SessionDoc, quizID: string, questionID: string, selectedAnswer: string) {
    const user = Sessioning.getUser(session);
    return await Quizing.answerQuestion(user, new ObjectId(quizID), Number(questionID), selectedAnswer);
  }

  @Router.get("/quizzes/:quizID/progress")
  async getPlayerProgress(session: SessionDoc, quizID: string) {
    const user = Sessioning.getUser(session);
    return await Quizing.getPlayerProgress(new ObjectId(quizID), user); // Use user
  }

  @Router.get("/quizzes/:quizID/leaderboard")
  async viewQuizLeaderboard(session: SessionDoc, quizID: string) {
    return await Quizing.getQuizLeaderboard(new ObjectId(quizID));
  }

  // PRAYER MATE
  // Prayer group and session routes

  // Create a new prayer group
  @Router.post("/prayer-group")
  async createPrayerGroup(session: SessionDoc, title: string, topic: string) {
    const leader = Sessioning.getUser(session);
    const group = await prayerMate.createPrayerGroup(leader, title, topic);
    return { msg: "Prayer group created successfully!", group };
  }

  // Join a prayer group
  @Router.put("/prayer-group/join/:groupID")
  async joinPrayerGroup(session: SessionDoc, groupID: string) {
    const user = Sessioning.getUser(session);
    const groupOid = new ObjectId(groupID);
    return await prayerMate.joinPrayerGroup(user, groupOid);
  }

  // Leave a prayer group
  @Router.put("/prayer-group/leave/:groupID")
  async leavePrayerGroup(session: SessionDoc, groupID: string) {
    const user = Sessioning.getUser(session);
    const groupOid = new ObjectId(groupID);
    return await prayerMate.leavePrayerGroup(user, groupOid);
  }

  // Start a prayer session for a group
  @Router.post("/prayer-session/start/:groupID")
  async startPrayerSession(session: SessionDoc, groupID: string) {
    const groupOid = new ObjectId(groupID);
    return await prayerMate.startPrayerSession(groupOid);
  }

  // End a prayer session for a group
  @Router.put("/prayer-session/end/:groupID")
  async endPrayerSession(session: SessionDoc, groupID: string) {
    const groupOid = new ObjectId(groupID);
    return await prayerMate.endPrayerSession(groupOid);
  }

  // Get members of a prayer group
  @Router.get("/prayer-group/members/:groupID")
  async getGroupMembers(session: SessionDoc, groupID: string) {
    const groupOid = new ObjectId(groupID);
    return await prayerMate.getGroupMembers(groupOid);
  }

  // Fetch all active prayer sessions
  @Router.get("/prayer-sessions/active")
  async getAllActiveSessions() {
    const activeSessions = await prayerMate.getAllActiveSessions();
    return { msg: "Active prayer sessions", activeSessions };
  }

  // Get active prayer session for a specific group
  @Router.get("/prayer-session/active/:groupID")
  async getActiveSession(session: SessionDoc, groupID: string) {
    const groupOid = new ObjectId(groupID);
    return await prayerMate.getActiveSession(groupOid);
  }

  // Get details of a specific prayer group
  @Router.get("/prayer-group/:groupID")
  async getPrayerGroup(session: SessionDoc, groupID: string) {
    const groupOid = new ObjectId(groupID);
    return await prayerMate.getPrayerGroup(groupOid);
  }

  // Get prayer session details by sessionID
  @Router.get("/prayer-session/:sessionID")
  async getPrayerSessionDetails(session: SessionDoc, sessionID: string) {
    const sessionOid = new ObjectId(sessionID);
    return await prayerMate.getSessionById(sessionOid);
  }

  //
  // EVENTS
  //
  // Create an event
  @Router.post("/events")
  async createEvent(
    session: SessionDoc,
    title: string,
    description: string,
    startDate: string,
    endDate: string,
    location: string,
    // attendeeIds?: string[], // Optional field to allow for attendee IDs
  ) {
    const user = Sessioning.getUser(session);

    // Call your createEvent function with the converted attendees
    const event = await Eventing.createEvent(title, description, new Date(startDate), new Date(endDate), location);

    return event;
  }

  // Get all events
  @Router.get("/events")
  async getEvents() {
    return await Eventing.getEvents();
  }

  // Get a specific event by ID
  @Router.get("/events/:eventId")
  async getEvent(eventId: string) {
    const event = await Eventing.getEvent(new ObjectId(eventId));
    return event;
  }

  // Update an event
  @Router.patch("/events/:eventId")
  async updateEvent(session: SessionDoc, eventId: string, title?: string, description?: string, startDate?: string, endDate?: string, location?: string, attendeeIds?: string[]) {
    const user = Sessioning.getUser(session);
    const updatedEvent = await Eventing.updateEvent(
      new ObjectId(eventId),
      title,
      description,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
      location,
      attendeeIds ? attendeeIds.map((id) => new ObjectId(id)) : undefined,
    );
    return { msg: "Event updated!", updatedEvent };
  }

  // Delete an event
  @Router.delete("/events/:eventId")
  async deleteEvent(session: SessionDoc, eventId: string) {
    const user = Sessioning.getUser(session);
    await Eventing.deleteEvent(new ObjectId(eventId));
    return { msg: "Event deleted!" };
  }

  // Get attendees of an event
  @Router.get("/events/:eventId/attendees")
  async getEventAttendees(eventId: string) {
    return await Eventing.getAttendees(new ObjectId(eventId));
  }

  // Add an attendee to an event
  @Router.post("/events/:eventId/attendees")
  async addAttendee(session: SessionDoc, eventId: string, attendeeId: string) {
    const user = Sessioning.getUser(session);
    await Eventing.addAttendee(new ObjectId(eventId), new ObjectId(attendeeId));
    return { msg: "Attendee added!" };
  }

  // Remove an attendee from an event
  @Router.delete("/events/:eventId/attendees/:attendeeId")
  async removeAttendee(session: SessionDoc, eventId: string, attendeeId: string) {
    const user = Sessioning.getUser(session);
    await Eventing.removeAttendee(new ObjectId(eventId), new ObjectId(attendeeId));
    return { msg: "Attendee removed!" };
  }

  // Update attendee status in an event
  @Router.patch("/events/:eventId/attendees/:attendeeId")
  async updateAttendeeStatus(session: SessionDoc, eventId: string, attendeeId: string, status: "going" | "not going" | "maybe") {
    const user = Sessioning.getUser(session);
    await Eventing.updateAttendeeStatus(new ObjectId(eventId), new ObjectId(attendeeId), status);
    return { msg: "Attendee status updated!" };
  }

  // PILGRIMAGE TOURING

  @Router.post("/pilgrimage-tour")
  async createPilgrimageTour(session: SessionDoc, title: string, description: string, location: string) {
    const user = Sessioning.getUser(session);

    const tour = await Touring.createPilgrimageTour(title, description, location);
    return { msg: "Pilgrimage tour created!", tour };
  }

  // Start a pilgrimage tour
  @Router.post("/pilgrimage-tour/:tourID/start")
  async startTour(session: SessionDoc, tourID: string) {
    const user = Sessioning.getUser(session);
    return await Touring.startTour(user, new ObjectId(tourID));
  }

  // Join a group pilgrimage tour
  @Router.post("/pilgrimage-tour/:tourID/join")
  async joinGroupTour(session: SessionDoc, tourID: string) {
    const user = Sessioning.getUser(session);
    return await Touring.joinGroupTour(user, new ObjectId(tourID));
  }

  // Get all pilgrimage tours
  @Router.get("/pilgrimage-tours")
  async getAllPilgrimageTours() {
    const tours = await Touring.tours.readMany({});
    return { msg: "All pilgrimage tours retrieved!", tours };
  }

  // View details of a pilgrimage tour
  @Router.get("/pilgrimage-tour/:tourID")
  async viewTourDetails(tourID: string) {
    return await Touring.viewTourDetails(new ObjectId(tourID));
  }

  // Leave a pilgrimage tour
  @Router.post("/pilgrimage-tour/:tourID/leave")
  async leaveTour(session: SessionDoc, tourID: string) {
    const user = Sessioning.getUser(session);
    return await Touring.leaveTour(user, new ObjectId(tourID));
  }
}

/** The web app. */
export const app = new Routes();

/** The Express router. */
export const appRouter = getExpressRouter(app);
