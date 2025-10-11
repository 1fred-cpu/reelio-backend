import { Injectable } from '@nestjs/common';
import { SignUpDto } from './dto/sign-up.dto';
import { DataSource } from 'typeorm';
import {
  ConflictException,
  NotFoundException,
} from '@exceptions/app.exception';
import { User } from '@entities/user.entity';
import { UsernameGeneratorService } from '@helpers/username-generator.service';
import { SignInDto } from './dto/sign-in.dto';
import { SignInWithGoogleDto } from './dto/sign-in-with-google.dto';
import { SignInWithAppleDto } from './dto/sign-in-with-apple.dto ';

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly usernameGenerator: UsernameGeneratorService,
  ) {}

  /**
   * Handles the process of registering a new user in the system.
   *
   * This method runs inside a TypeORM-managed database transaction to ensure
   * data consistency. It performs the following steps:
   *
   * 1. **Check for duplicates** — Verifies that no existing user already uses
   *    the provided email address.
   * 2. **Generate username** — Creates a unique username based on the user's
   *    full name using the injected `UsernameGenerator` service.
   * 3. **Create user record** — Persists a new `User` entity with the provided
   *    full name, email, and Supabase authentication ID.
   * 4. **Return sanitized data** — Returns a response containing only safe,
   *    non-sensitive user information.
   *
   * @async
   * @param {SignUpDto} dto - The data transfer object containing user registration details.
   * @param {string} dto.fullName - The user's full name, used to generate a username.
   * @param {string} dto.email - The user's email address; must be unique.
   * @param {string} dto.authId - The Supabase Auth user ID associated with this account.
   *
   * @throws {ConflictException} If a user already exists with the provided email address.
   * @throws {InternalServerErrorException} If any unexpected error occurs during the transaction.
   *
   * @returns {Promise<object>} A promise resolving to a sanitized user object containing:
   * - `fullName`: The user’s full name.
   * - `email`: The user’s email address.
   * - `authId`: The Supabase Auth ID.
   * - `role`: The user’s assigned role (e.g., `user`, `admin`).
   * - `username`: The generated username.
   * - `avatarUrl`: The user’s avatar image URL, if available.
   * - `preferences`: The user’s stored preferences object (if any).
   *
   * @example
   * ```ts
   * const user = await userService.signUpUser({
   *   fullName: "Jane Doe",
   *   email: "jane@example.com",
   *   authId: "auth-uid-123"
   * });
   * console.log(user.username); // e.g. "jane_doe"
   * ```
   */

  async signUpUser(dto: SignUpDto) {
    return this.dataSource.transaction(async (manager) => {
      const { fullName, email, authId } = dto;

      // 1. Check user already exists
      const existingUser = await manager.findOne(User, {
        where: {
          email,
        },
        lock: {
          mode: 'pessimistic_write',
        },
      });
      if (existingUser) {
        throw new ConflictException(
          'A user already exists with this credentials',
        );
      }

      // 2. Create a new user record
      const user = manager.create(User, {
        full_name: fullName,
        email,
        auth_provider: 'email',
        auth_id: authId,
        username: this.usernameGenerator.generate(fullName),
      });

      const newUser = await manager.save(user);
      return this.toUserResponse(newUser);
    });
  }

  /**
   * Handles user sign-in by verifying that the provided credentials match
   * an existing user record in the database.
   *
   * This method executes within a TypeORM-managed transaction to ensure
   * data consistency. It retrieves the user using the provided Supabase
   * Auth ID and email, ensuring that the user exists and is valid.
   *
   * @async
   * @param {SignInDto} dto - The data transfer object containing sign-in credentials.
   * @param {string} dto.email - The user's registered email address.
   * @param {string} dto.authId - The Supabase Auth user ID associated with this account.
   *
   * @throws {NotFoundException} If no user is found with the given email and auth ID.
   * @throws {InternalServerErrorException} If an unexpected database error occurs.
   *
   * @returns {Promise<object>} A promise resolving to a sanitized user object containing:
   * - `fullName`: The user's full name.
   * - `email`: The user's email address.
   * - `authId`: The Supabase Auth ID.
   * - `role`: The user’s assigned role.
   * - `username`: The user’s username.
   * - `avatarUrl`: The user’s avatar image URL, if available.
   * - `preferences`: The user’s stored preferences object (if any).
   *
   * @example
   * ```ts
   * const user = await userService.signInUser({
   *   email: "jane@example.com",
   *   authId: "auth-uid-123"
   * });
   * console.log(user.username); // e.g. "jane_doe"
   * ```
   */

  async signInUser(dto: SignInDto) {
    const { email, authId } = dto;

    // Run an atomic transaction db
    return this.dataSource.transaction(async (manager) => {
      // Get user from db
      const user = await manager.findOne(User, {
        where: {
          auth_id: authId,
          email,
        },
      });

      // Throw not found exception when user not found
      if (!user) {
        throw new NotFoundException('User cannot be found');
      }

      return this.toUserResponse(user);
    });
  }

  /**
   * Handles user sign-in via Google authentication.
   *
   * This method ensures a seamless login or registration flow for Google users:
   * - Checks if a user with the given email already exists (with a database lock to prevent race conditions).
   * - If the user exists, returns their profile information.
   * - Otherwise, creates a new user record and returns the newly created profile.
   *
   * @param dto - The data transfer object containing Google user credentials (`email`, `fullName`, `authId`).
   * @returns The user's profile data (name, email, authId, role, username, avatar, preferences).
   *
   * @throws {ConflictException} If a data conflict occurs during creation.
   * @throws {InternalServerErrorException} For unexpected database or transaction errors.
   */

  async signInWithGoogle(dto: SignInWithGoogleDto) {
    const { email, fullName, authId } = dto;

    return this.dataSource.transaction(async (manager) => {
      // 1. check if a google user exist
      const existingGoogleUser = await manager.findOne(User, {
        where: {
          email,
        },
        lock: {
          mode: 'pessimistic_write',
        },
      });

      // 2. Send credentials if google user already exists
      if (existingGoogleUser) {
        return this.toUserResponse(existingGoogleUser);
      }

      // 3. Create a new google user if not exists
      const user = manager.create(User, {
        full_name: fullName,
        auth_id: authId,
        email,
        auth_provider: 'google',
        username: this.usernameGenerator.generate(fullName),
      });

      const newGoogleUser = await manager.save(user);

      // 4. Return credentials
      return this.toUserResponse(newGoogleUser);
    });
  }

  /**
   * Handles user sign-in via Apple authentication.
   *
   * This method ensures a seamless login or registration flow for Apple users:
   * - Checks if a user with the given email already exists (with a database lock to prevent race conditions).
   * - If the user exists, returns their profile information.
   * - Otherwise, creates a new user record and returns the newly created profile.
   *
   * @param dto - The data transfer object containing Apple user credentials (`email`, `fullName`, `authId`).
   * @returns The user's profile data (name, email, authId, role, username, avatar, preferences).
   *
   * @throws {ConflictException} If a data conflict occurs during creation.
   * @throws {InternalServerErrorException} For unexpected database or transaction errors.
   */
  async signInWithApple(dto: SignInWithAppleDto) {
    const { email, fullName, authId } = dto;

    return this.dataSource.transaction(async (manager) => {
      // 1. check if a apple user exist
      const existingAppleUser = await manager.findOne(User, {
        where: {
          email,
        },
        lock: {
          mode: 'pessimistic_write',
        },
      });

      // 2. Send credentials if apple user already exists
      if (existingAppleUser) {
        return this.toUserResponse(existingAppleUser);
      }

      // 3. Create a new apple user if not exists
      const user = manager.create(User, {
        full_name: fullName,
        auth_id: authId,
        email,
        auth_provider: 'apple',
        username: this.usernameGenerator.generate(fullName),
      });

      const newAppleUser = await manager.save(user);

      // 4. Return credentials
      return this.toUserResponse(newAppleUser);
    });
  }

  private toUserResponse(user: User) {
    return {
      fullName: user.full_name,
      email: user.email,
      authId: user.auth_id,
      role: user.role,
      username: user.username,
      avatarUrl: user.avatar_url,
      preferences: user.preferences,
    };
  }
}
