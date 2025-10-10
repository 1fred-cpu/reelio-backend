import { Injectable } from "@nestjs/common";
import { NotFoundException } from "@exceptions/app.exception";
@Injectable()
export class AppService {
    getHello(): string {
        throw new NotFoundException("Item not found");
        return "Hello World!";
    }
}
