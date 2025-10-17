import {
    Injectable,
    Logger,
    InternalServerErrorException,
    NotFoundException
} from "@nestjs/common";
import { DataSource, Not } from "typeorm";
import { Content } from "@entities/content.entity";
import { User } from "@entities/user.entity";
import { WatchHistory } from "@entities/watch-history.entity";
import { ContentStatus } from "@entities/content.entity";
@Injectable()
export class HomeService {
    private readonly logger = new Logger(HomeService.name);

    constructor(private readonly dataSource: DataSource) {}

    /* ===== GET HOME FEED ===== */
    async getHomeFeed(userId: string) {
        try {
            const [
                heroBanner,
                continueWatching,
                trendingContent,
                featuredCreators,
                recommended
            ] = await Promise.all([
                this.getHeroBanner(),
                this.getContinueWatching(userId),
                this.getTrendingContent(),
                this.getFeaturedCreators(),
                this.getRecommended(userId)
            ]);

            return {
                heroBanner,
                continueWatching,
                trendingContent,
                featuredCreators,
                recommended
            };
        } catch (error) {
          if(error instanceof NotFoundException){
            throw error 
          }
            this.logger.error("Failed to get home feed", error);
            throw new InternalServerErrorException(
                "An unexpected error occurred while fetching home feed"
            );
        }
    }

    /* ===== HERO BANNER ===== */
    private async getHeroBanner() {
        const contentRepo = this.dataSource.getRepository(Content);

        const heroBanner = await contentRepo.findOne({
            where: { featured: true, status: ContentStatus.PUBLISHED },
            select: {
                id: true,
                title: true,
                type: true,
                thumbnail_url: true,
                created_at: true,
                creator: {
                    id: true,
                    full_name: true,
                    avatar_url: true
                }
            },
            order: { created_at: "DESC" },
            relations: ["creator"]
        });

        if (!heroBanner)
            throw new NotFoundException("No featured content found");

        return {
            id: heroBanner.id,
            title: heroBanner.title,
            type: heroBanner.type,
            thumbnailUrl: heroBanner.thumbnail_url,
            creator: {
                id: heroBanner.creator.id,
                fullName: heroBanner.creator.full_name,
                avatarUrl: heroBanner.creator.avatar_url
            }
        };
    }

    /* ===== CONTINUE WATCHING ===== */
    private async getContinueWatching(userId: string) {
        if (!userId) return [];

        const watchRepo = this.dataSource.getRepository(WatchHistory);
        const records = await this.dataSource
            .getRepository(WatchHistory)
            .createQueryBuilder("watch")
            .leftJoinAndSelect("watch.content", "content")
            .select([
                "watch.id AS id",
                "watch.progress_seconds AS progress_seconds",
                "content.id AS content_id",
                "content.title AS title",
                "content.thumbnail_url AS thumbnail_url"
            ])
            .where("watch.user_id = :userId", { userId })
            .andWhere("watch.progress_seconds != :progress", { progress: 100 })
            .orderBy("watch.updated_at", "DESC")
            .limit(10)
            .getRawMany();

        return records.map(r => ({
            contentId: r.content_id,
            title: r.title,
            progressSeconds: r.progress_seconds,
            thumbnailUrl: r.thumbnail_url
        }));
    }

    /* ===== TRENDING CONTENT ===== */
    private async getTrendingContent() {
        const contentRepo = this.dataSource.getRepository(Content);

        // Example: Trending = most liked or viewed recently
        const trending = await contentRepo
            .createQueryBuilder("content")
            .leftJoin("content.creator", "creator")
            .leftJoin("content.likes", "likes")
            .leftJoin("content.views", "views")
            .select([
                "content.id AS id",
                "content.title AS title",
                "content.thumbnail_url AS thumbnail_url",
                "creator.id AS creator_id",
                "creator.full_name AS creator_full_name",
                "creator.avatar_url AS creator_avatar_url",
                "COUNT(DISTINCT likes.id) AS likes_count",
                "COUNT(DISTINCT views.id) AS views_count"
            ])
            .where("content.status = :status", {
                status: ContentStatus.PUBLISHED
            })
            .groupBy("content.id")
            .addGroupBy("creator.id")
            .orderBy("likes_count", "DESC")
            .addOrderBy("views_count", "DESC")
            .limit(10)
            .getRawMany();

        return trending.map(item => ({
            id: item.id,
            title: item.title,
            thumbnailUrl: item.thumbnail_url,
            likesCount: item.likes_count,
            viewsCount: item.views_count,
            creator: {
                id: item.creator.id,
                fullName: item.creator.full_name,
                avatarUrl: item.creator.avatar_url
            }
        }));
    }

    /* ===== FEATURED CREATORS ===== */
    private async getFeaturedCreators() {
        const userRepo = this.dataSource.getRepository(User);

        const creators = await userRepo
            .createQueryBuilder("user")
            .leftJoinAndSelect("user.followers", "followers")
            .select([
                "user.id",
                "user.full_name",
                "user.avatar_url",
                "COUNT(followers.id) AS followersCount"
            ])
            .where("user.featured = :featured", { featured: true })
            .andWhere("user.role = :role", { role: "creator" })
            .groupBy("user.id")
            .orderBy("followersCount", "DESC")
            .limit(5)
            .getRawMany();

        return creators.map(c => ({
            id: c.user_id,
            fullName: c.full_name,
            avatarUrl: c.avatar_url,
            followers: Number(c.followersCount) || 0
        }));
    }

    /* ===== RECOMMENDED CONTENT ===== */
    private async getRecommended(userId: string) {
        const contentRepo = this.dataSource.getRepository(Content);

        // In the future: Use AI, tags, or similar genres
        const recommended = await contentRepo.find({
            where: { status: ContentStatus.PUBLISHED },
            select: { id: true, title: true, thumbnail_url: true },
            order: { created_at: "DESC" },
            take: 10
        });

        return recommended.map(item => ({
            id: item.id,
            title: item.title,
            thumbnailUrl: item.thumbnail_url
        }));
    }
}
