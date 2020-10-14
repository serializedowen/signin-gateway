import { Controller } from "egg";
import {
  Prefix,
  Get,
  Post,
  Body,
  Query,
  Header,
  Param,
  Guard,
} from "egg-shell-decorators-plus";
import { UserDTO } from "app/model/dto/UserDTO";
import activeUserCache from "app/activeUserCache";
import Authenticated from "app/decorators/Authenticated";
import { pick } from "lodash";

import UseGuard from "app/decorators/guards/UseGuard";
import AdminAndSelfGuard from "app/decorators/guards/AdminAndSelfGuard";

@Prefix("/auth")
export default class AuthController extends Controller {
  constructor(props) {
    super(props);
  }

  @Get("/check")
  public async check() {
    if (this.ctx.isAuthenticated()) this.ctx.status = 200;
    else this.ctx.status = 401;
  }

  @Get("/decodeToken")
  @Authenticated()
  public decodeToken() {
    this.ctx.body = this.ctx.user;
  }

  @Get("/signout")
  public async signout() {
    this.ctx.logout();
  }

  @Post("/signup")
  public async signup() {
    const user = await this.ctx.service.auth.createUser(this.ctx.request.body);
    this.ctx.body = this.service.jwt.encode(user);
  }

  @Authenticated()
  @Get("/verify-third-party-user")
  public async wireProviderCredential() {
    if (!this.ctx.user) return;

    const thirdPartyData = this.ctx.user;

    this.ctx.status = 200;

    switch (thirdPartyData.provider) {
      case "github": {
        const params: Partial<userDAO> = {};

        params.avatarUrl = thirdPartyData.photo;
        params.name = thirdPartyData.name;
        params.password = "123456";

        const record = await this.service.auth.findLinkedLocalAccountId(
          thirdPartyData.id,
          thirdPartyData.provider
        );

        if (record) {
          const user = await this.service.auth.findUserByPK(record.userId);
          activeUserCache.set(user.id, user);
          this.ctx.user.userId = user.id;
        } else {
          const user = await this.service.auth.createUser(params);
          activeUserCache.set(user.id, user);

          await this.service.auth.createProviderMetadata({
            provider: thirdPartyData.provider,
            providerId: thirdPartyData.id,
            userId: user.id,
          });

          this.ctx.user.userId = user.id;
        }

        break;
      }

      default:
    }

    const redirectUrl = this.ctx.cookies.get("redirect", { encrypt: true });
    if (redirectUrl) {
      this.ctx.redirect(redirectUrl);
    }
  }

  @Get("/:userId")
  @UseGuard(AdminAndSelfGuard)
  @Authenticated()
  public async getUserData(@Param("userId") userId: number) {
    const user = await this.ctx.service.auth.findUserByPK(Number(userId));

    if (user) this.ctx.body = user;
    else this.ctx.status = 404;
  }

  @Post("/:userId/update")
  @UseGuard(AdminAndSelfGuard)
  @Authenticated()
  public async updateUserInfo(
    @Param("userId") userId: string,
    @Body updated: UserDTO
  ) {
    const m = await this.ctx.user?.userModel.update(
      pick(updated, ["phone", "age", "name", "email"])
    );
  }
}