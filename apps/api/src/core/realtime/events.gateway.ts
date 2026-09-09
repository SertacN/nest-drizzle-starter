import { Logger } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway } from '@nestjs/websockets';
import { parse as parseCookie } from 'cookie';
import type { IncomingMessage } from 'node:http';
import { ACCESS_TOKEN_COOKIE } from 'shared';
import type { WebSocket } from 'ws';
import { TokenService } from '../security/token.service';

/**
 * Browsers cannot set an Authorization header on a WebSocket handshake — which is exactly why
 * httpOnly cookies suit this well: the browser sends them on the upgrade request by itself and
 * the identity is derived from the token, never from anything the client claims afterwards.
 *
 * A mobile app has neither a cookie jar nor a header it can set, so it appends the access
 * token as a query parameter instead. Same token, same verification — see extractToken().
 *
 * State is in-memory, which assumes a SINGLE API instance. Scaling out means putting Redis
 * pub/sub behind sendToUser() before starting a second one.
 */
@WebSocketGateway({ path: '/ws' })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
	private readonly logger = new Logger(EventsGateway.name);
	private readonly clients = new Map<WebSocket, string>();

	constructor(private readonly tokenService: TokenService) {}

	async handleConnection(client: WebSocket, request: IncomingMessage): Promise<void> {
		const token = this.extractToken(request);
		if (!token) return this.reject(client, 'missing_token');

		try {
			const payload = await this.tokenService.verifyAccessToken(token);
			this.clients.set(client, payload.sub);
			client.send(JSON.stringify({ type: 'connected' }));
		} catch {
			// The client's access token simply expired: it will refresh over HTTP and reconnect.
			this.reject(client, 'invalid_token');
		}
	}

	handleDisconnect(client: WebSocket): void {
		this.clients.delete(client);
	}

	/** Sends an event to every open socket of one user — all their tabs and devices. */
	sendToUser(userId: string, type: string, data: unknown): void {
		const payload = JSON.stringify({ type, data });
		for (const [socket, socketUserId] of this.clients) {
			// readyState 1 === OPEN. A socket mid-close would throw on send().
			if (socketUserId === userId && socket.readyState === 1) socket.send(payload);
		}
	}

	/**
	 * Cookie first, then `?token=`. The query parameter is the mobile path: React Native's
	 * WebSocket sends no cookies and accepts no headers, so there is nowhere else to put it.
	 *
	 * A URL is the leakiest place a credential can sit — it lands in proxy and access logs — so
	 * this accepts ONLY the 15-minute access token, never the refresh one, and anything logging
	 * upgrade URLs should redact the parameter.
	 */
	private extractToken(request: IncomingMessage): string | undefined {
		const fromCookie = parseCookie(request.headers.cookie ?? '')[ACCESS_TOKEN_COOKIE];
		if (fromCookie) return fromCookie;

		// The base is a throwaway: `request.url` on an upgrade is path-only, and URL needs one.
		const { searchParams } = new URL(request.url ?? '/', 'http://localhost');
		return searchParams.get('token') ?? undefined;
	}

	private reject(client: WebSocket, reason: string): void {
		this.logger.debug(`ws handshake rejected: ${reason}`);
		client.send(JSON.stringify({ type: 'unauthorized', reason }));
		// 1008 = policy violation. Closing beats leaving an unauthenticated socket connected.
		client.close(1008, reason);
	}
}
