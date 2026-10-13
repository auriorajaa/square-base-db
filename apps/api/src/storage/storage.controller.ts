import { IsEnum, IsNumber, IsString } from "class-validator";
import type { BucketAccess } from "@square-base-db/types";
import { createRouteHandler } from "uploadthing/express";
import { storageRouter } from "./uploadthing.js";
import {
  All,
  Body,
  Controller,
  Delete,
  Get,
  Next,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { OrgRoleGuard } from "../auth/guards/org-role.guard.js";
import { StorageService } from "./storage.service.js";
import type { NextFunction, Request, Response } from "express";

class CreateBucketDto {
  @IsString()
  name!: string;

  @IsEnum(["public", "private"])
  access!: BucketAccess;
}

class SaveObjectDto {
  @IsString()
  name!: string;

  @IsNumber()
  size!: number;

  @IsString()
  type!: string;

  @IsString()
  utKey!: string;

  @IsString()
  url!: string;
}

const utHandler = createRouteHandler({ router: storageRouter });

@Controller("orgs/:slug/projects/:projectSlug/storage")
@UseGuards(JwtAuthGuard, OrgRoleGuard)
export class StorageController {
  constructor(private storageService: StorageService) {}

  @Get("buckets")
  getBuckets(
    @Param("slug") slug: string,
    @Param("projectSlug") projectSlug: string,
  ) {
    return this.storageService.getBuckets(slug, projectSlug);
  }

  @Post("buckets")
  createBucket(
    @Param("slug") slug: string,
    @Param("projectSlug") projectSlug: string,
    @Body() dto: CreateBucketDto,
  ) {
    return this.storageService.createBucket(
      slug,
      projectSlug,
      dto.name,
      dto.access,
    );
  }

  @Delete("buckets/:bucketId")
  deleteBucket(@Param("bucketId") bucketId: string) {
    return this.storageService.deleteBucket(bucketId);
  }

  @Get("buckets/:bucketId/objects")
  getObjects(@Param("bucketId") bucketId: string) {
    return this.storageService.getObjects(bucketId);
  }

  @All("buckets/:bucketId/upload")
  async handleUpload(
    @Param("slug") slug: string,
    @Param("projectSlug") projectSlug: string,
    @Param("bucketId") bucketId: string,
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ): Promise<void> {
    // The UploadThing router has no middleware and the bucketId is dropped
    // when the URL is rewritten below, so validate the bucket here first:
    // it must exist and belong to the project in the URL.
    await this.storageService.getBucketInProject(slug, projectSlug, bucketId);

    // Save the original URL so we can restore it later
    const originalUrl = req.url;
    // Extract the query string from the original URL and set it as the new URL for the UploadThing handler
    const queryIndex = originalUrl.indexOf("?");
    // If there is a query string, slice it from the original URL; otherwise, set it to an empty string
    const query = queryIndex >= 0 ? originalUrl.slice(queryIndex) : "";

    // Set the request URL to the query string so that UploadThing can handle it correctly
    req.url = `/${query}`;
    // Call the UploadThing handler and restore the original URL after it completes
    utHandler(req, res, (err?: unknown) => {
      req.url = originalUrl;
      // If there was an error, pass it to the next middleware
      if (err) next(err);
    });
  }

  @Post("buckets/:bucketId/objects")
  saveObject(@Param("bucketId") bucketId: string, @Body() file: SaveObjectDto) {
    return this.storageService.saveObject(bucketId, file);
  }

  @Delete("objects/:objectId")
  deleteObject(@Param("objectId") objectId: string) {
    return this.storageService.deleteObject(objectId);
  }

  @Get("objects/:objectId/signed-url")
  getSignedUrl(@Param("objectId") objectId: string) {
    return this.storageService.getSignedUrl(objectId);
  }
}
