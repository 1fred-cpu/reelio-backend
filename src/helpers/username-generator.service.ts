import { Injectable } from '@nestjs/common';

@Injectable()
export class UsernameGeneratorService {
  /**
   * Generate a username from a user's full name.
   * Adds a random numeric suffix for uniqueness.
   * @param fullName The user's full name (e.g., "John Doe")
   */
  generate(fullName: string): string {
    if (!fullName) {
      throw new Error('Full name is required');
    }

    // Normalize and split name
    const name = fullName.trim().toLowerCase();
    const parts = name.split(/\s+/);

    // Build base: first + last
    let base = '';
    if (parts.length === 1) {
      base = parts[0];
    } else {
      base = `${parts[0]}.${parts[parts.length - 1]}`;
    }

    // Remove invalid characters
    base = base.replace(/[^a-z0-9.]/g, '');

    // Add random suffix (4 digits)
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);

    return `${base}${randomSuffix}`;
  }
}