const NOT_IMPLEMENTED = "Authentication is not implemented yet";

export class SquareBaseDbAuth {
  constructor(
    private projectUrl: string,
    private apiKey: string,
  ) {}

  async signup(credentials: { email: string; password: string }) {
    throw new Error(NOT_IMPLEMENTED);
  }

  async signin(credentials: { email: string; password: string }) {
    throw new Error(NOT_IMPLEMENTED);
  }

  async signout() {
    throw new Error(NOT_IMPLEMENTED);
  }

  async getUser() {
    throw new Error(NOT_IMPLEMENTED);
  }
}
