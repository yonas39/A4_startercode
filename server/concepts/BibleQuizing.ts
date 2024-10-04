import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

/**
 * Interface for a Question Document
 */
interface QuestionDoc extends BaseDoc {
  quizId: ObjectId;
  question: string;
  options: string[];
  answer: string;
}

/**
 * Interface for a Quiz Document
 */
export interface QuizDoc extends BaseDoc {
  title: string;
  questions: ObjectId[];
  status: "published" | "unpublished";
}

/**
 * Interface for a Player's Progress in a Quiz
 */
export interface PlayerProgressDoc extends BaseDoc {
  quizId: ObjectId;
  playerId: ObjectId;
  answeredQuestions: ObjectId[];
}

/**
 * Concept: BibleQuiz [User]
 * Manages the creation, publication, and player progress tracking for Bible quizzes.
 */
export default class BibleQuizConcept {
  public readonly quizzes: DocCollection<QuizDoc>;
  public readonly questions: DocCollection<QuestionDoc>;
  public readonly progress: DocCollection<PlayerProgressDoc>;

  /**
   * Make an instance of BibleQuizConcept.
   */
  constructor(collectionName: string) {
    this.quizzes = new DocCollection<QuizDoc>(collectionName + "_quizzes");
    this.questions = new DocCollection<QuestionDoc>(collectionName + "_questions");
    this.progress = new DocCollection<PlayerProgressDoc>(collectionName + "_progress");
  }

  /**
   * Create a new quiz with a set of questions.
   */
  async createQuiz(title: string, questionList: { question: string; options: string[]; answer: string }[]): Promise<{ msg: string; quiz: QuizDoc }> {
    // Create questions and get their ObjectIds
    const questionIds = await Promise.all(
      questionList.map(async (q) => {
        const questionDocId = await this.questions.createOne({
          quizId: new ObjectId(), // Temporary quizId; will be updated after quiz creation
          question: q.question,
          options: q.options,
          answer: q.answer,
        });
        return questionDocId;
      })
    );

    // Create the quiz with the title and the created question IDs
    const quizId = await this.quizzes.createOne({ title, questions: questionIds, status: "unpublished" });

    // Update each question with the correct quizId
    await Promise.all(
      questionIds.map((qId) => this.questions.partialUpdateOne({ _id: qId }, { quizId }))
    );

    const quiz = await this.quizzes.readOne({ _id: quizId });

    // If quiz is null, this indicates a problem after updating the document.
    if (!quiz) {
      throw new QuizNotFoundError(quizId);
    }

    return { msg: "Quiz published!", quiz };
  }

  /**
   * Publish a quiz so that users can play it.
   */
  async publishQuiz(quizId: ObjectId): Promise<{ msg: string; quiz: QuizDoc }> {
    const result = await this.quizzes.partialUpdateOne({ _id: quizId }, { status: "published" });
    if (result.modifiedCount === 0) throw new QuizNotFoundError(quizId);
    const quiz = await this.quizzes.readOne({ _id: quizId });

    // If quiz is null, this indicates a problem after updating the document.
    if (!quiz) {
      throw new QuizNotFoundError(quizId);
    }

    return { msg: "Quiz published!", quiz };
  }

  /**
   * Get a list of quizzes based on their status.
   */
  async getQuizzesByStatus(status: "published" | "unpublished"): Promise<QuizDoc[]> {
    return await this.quizzes.readMany({ status });
  }

  /**
   * Start playing a quiz by initializing player's progress.
   */
  async startQuiz(quizId: ObjectId, playerId: ObjectId): Promise<{ msg: string; quizId: ObjectId; playerId: ObjectId }> {
    const quiz = await this.quizzes.readOne({ _id: quizId, status: "published" });
    if (quiz === null) throw new QuizNotFoundError(quizId);

    // Initialize player progress
    await this.progress.createOne({ quizId, playerId, answeredQuestions: [] });
    return { msg: "Started quiz!", quizId, playerId };
  }

  /**
   * Record an answer for a player in a given quiz.
   */
  async answerQuestion(quizId: ObjectId, playerId: ObjectId, questionId: ObjectId, answer: string): Promise<{ msg: string; isCorrect: boolean }> {
    const question = await this.questions.readOne({ _id: questionId });
    if (question === null) throw new QuestionNotFoundError(questionId);

    const progress = await this.progress.readOne({ quizId, playerId });
    if (progress === null) throw new PlayerProgressNotFoundError(playerId, quizId);

    // Check if question has already been answered
    if (progress.answeredQuestions.includes(questionId)) {
      throw new QuestionAlreadyAnsweredError(questionId, playerId);
    }

    // Update player progress by adding the answered question
    await this.progress.partialUpdateOne({ quizId, playerId }, { answeredQuestions: [...progress.answeredQuestions, questionId] });

    // Check if the answer is correct
    const isCorrect = question.answer === answer;
    return { msg: isCorrect ? "Correct answer!" : "Incorrect answer.", isCorrect };
  }

  /**
   * Get the player's progress for a given quiz.
   */
  async getPlayerProgress(quizId: ObjectId, playerId: ObjectId): Promise<{ msg: string; progress: PlayerProgressDoc }> {
    const progress = await this.progress.readOne({ quizId, playerId });
    if (progress === null) throw new PlayerProgressNotFoundError(playerId, quizId);

    // Return progress details along with the list of answered questions
    return { msg: "Progress fetched!", progress };
  }

  // Helper Private Functions
  private async assertQuizExists(quizId: ObjectId): Promise<void> {
    const quiz = await this.quizzes.readOne({ _id: quizId });
    if (quiz === null) {
      throw new QuizNotFoundError(quizId);
    }
  }
}

// Custom Error Messages designed for BibleQuiz concept
export class QuizNotFoundError extends NotFoundError {
  constructor(public readonly quizId: ObjectId) {
    super(`Quiz with ID ${quizId} does not exist!`, quizId);
  }
}

export class QuestionNotFoundError extends NotFoundError {
  constructor(public readonly questionId: ObjectId) {
    super(`Question with ID ${questionId} does not exist!`, questionId);
  }
}

export class PlayerProgressNotFoundError extends NotFoundError {
  constructor(public readonly playerId: ObjectId, public readonly quizId: ObjectId) {
    super(`Player progress for player ${playerId} in quiz ${quizId} does not exist!`, playerId, quizId);
  }
}

export class QuestionAlreadyAnsweredError extends NotAllowedError {
  constructor(public readonly questionId: ObjectId, public readonly playerId: ObjectId) {
    super(`Question ${questionId} has already been answered by player ${playerId}!`, questionId, playerId);
  }
}
