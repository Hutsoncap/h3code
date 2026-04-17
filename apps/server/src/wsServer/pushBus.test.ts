import type { WebSocket } from "ws";
import { it } from "@effect/vitest";
import { describe, expect } from "vitest";
import { Effect, Ref } from "effect";
import { WS_CHANNELS } from "@t3tools/contracts";

import { makeServerPushBus } from "./pushBus";

class MockWebSocket {
  static readonly OPEN = 1;

  readonly OPEN = MockWebSocket.OPEN;
  readyState = MockWebSocket.OPEN;
  readonly sent: string[] = [];
  throwOnSend = false;
  private readonly waiters = new Set<() => void>();

  send(message: string) {
    if (this.throwOnSend) {
      throw new Error("mock send failure");
    }
    this.sent.push(message);
    for (const waiter of this.waiters) {
      waiter();
    }
  }

  waitForSentCount(count: number): Promise<void> {
    if (this.sent.length >= count) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const check = () => {
        if (this.sent.length < count) {
          return;
        }
        this.waiters.delete(check);
        resolve();
      };

      this.waiters.add(check);
    });
  }
}

describe("makeServerPushBus", () => {
  it.live("waits for the welcome push before a new client joins broadcast delivery", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const client = new MockWebSocket();
        const clients = yield* Ref.make(new Set<WebSocket>());
        const pushBus = yield* makeServerPushBus({
          clients,
          logOutgoingPush: () => {},
        });

        yield* pushBus.publishAll(WS_CHANNELS.serverConfigUpdated, {
          issues: [{ kind: "keybindings.malformed-config", message: "queued-before-connect" }],
          providers: [],
        });

        const delivered = yield* pushBus.publishClient(
          client as unknown as WebSocket,
          WS_CHANNELS.serverWelcome,
          {
            cwd: "/tmp/project",
            projectName: "project",
          },
        );
        expect(delivered).toBe(true);

        yield* Ref.update(clients, (current) => current.add(client as unknown as WebSocket));

        yield* pushBus.publishAll(WS_CHANNELS.serverConfigUpdated, {
          issues: [],
          providers: [],
        });

        yield* Effect.promise(() => client.waitForSentCount(2));

        const messages = client.sent.map(
          (message) => JSON.parse(message) as { channel: string; data: unknown },
        );

        expect(messages).toHaveLength(2);
        expect(messages[0]).toEqual({
          type: "push",
          sequence: 2,
          channel: WS_CHANNELS.serverWelcome,
          data: {
            cwd: "/tmp/project",
            projectName: "project",
          },
        });
        expect(messages[1]).toEqual({
          type: "push",
          sequence: 3,
          channel: WS_CHANNELS.serverConfigUpdated,
          data: {
            issues: [],
            providers: [],
          },
        });
      }),
    ),
  );

  it.live("delivers targeted pushes only to the addressed client", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const broadcastClient = new MockWebSocket();
        const targetedClient = new MockWebSocket();
        const clients = yield* Ref.make(
          new Set<WebSocket>([broadcastClient as unknown as WebSocket]),
        );
        const deliveries: Array<{ channel: string; recipients: number }> = [];
        const pushBus = yield* makeServerPushBus({
          clients,
          logOutgoingPush: (push, recipients) => {
            deliveries.push({ channel: push.channel, recipients });
          },
        });

        const delivered = yield* pushBus.publishClient(
          targetedClient as unknown as WebSocket,
          WS_CHANNELS.serverWelcome,
          {
            cwd: "/tmp/project",
            projectName: "project",
          },
        );

        expect(delivered).toBe(true);
        yield* Effect.promise(() => targetedClient.waitForSentCount(1));
        expect(targetedClient.sent).toHaveLength(1);
        expect(broadcastClient.sent).toHaveLength(0);
        const targetedMessage = targetedClient.sent[0];
        expect(targetedMessage).toBeDefined();
        expect(JSON.parse(targetedMessage!)).toEqual({
          type: "push",
          sequence: 1,
          channel: WS_CHANNELS.serverWelcome,
          data: {
            cwd: "/tmp/project",
            projectName: "project",
          },
        });
        expect(deliveries).toEqual([{ channel: WS_CHANNELS.serverWelcome, recipients: 1 }]);
      }),
    ),
  );

  it.live("continues broadcast delivery after one client.send throws", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const failingClient = new MockWebSocket();
        failingClient.throwOnSend = true;
        const laterClientA = new MockWebSocket();
        const laterClientB = new MockWebSocket();
        const clients = yield* Ref.make(
          new Set<WebSocket>([
            failingClient as unknown as WebSocket,
            laterClientA as unknown as WebSocket,
            laterClientB as unknown as WebSocket,
          ]),
        );
        const deliveries: Array<{ channel: string; recipients: number }> = [];
        const pushBus = yield* makeServerPushBus({
          clients,
          logOutgoingPush: (push, recipients) => {
            deliveries.push({ channel: push.channel, recipients });
          },
        });

        yield* pushBus.publishAll(WS_CHANNELS.serverConfigUpdated, {
          issues: [],
          providers: [],
        });

        yield* Effect.promise(() => laterClientA.waitForSentCount(1));
        yield* Effect.promise(() => laterClientB.waitForSentCount(1));

        expect(failingClient.sent).toHaveLength(0);
        expect(laterClientA.sent).toHaveLength(1);
        expect(laterClientB.sent).toHaveLength(1);
        const laterMessageA = laterClientA.sent[0];
        expect(laterMessageA).toBeDefined();
        expect(JSON.parse(laterMessageA!)).toEqual({
          type: "push",
          sequence: 1,
          channel: WS_CHANNELS.serverConfigUpdated,
          data: {
            issues: [],
            providers: [],
          },
        });
        const laterMessageB = laterClientB.sent[0];
        expect(laterMessageB).toBeDefined();
        expect(JSON.parse(laterMessageB!)).toEqual({
          type: "push",
          sequence: 1,
          channel: WS_CHANNELS.serverConfigUpdated,
          data: {
            issues: [],
            providers: [],
          },
        });
        expect(deliveries).toEqual([{ channel: WS_CHANNELS.serverConfigUpdated, recipients: 2 }]);
      }),
    ),
  );

  it.live("skips closed clients while preserving sequence order for later broadcasts", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const openClient = new MockWebSocket();
        const closedClient = new MockWebSocket();
        closedClient.readyState = 0;

        const clients = yield* Ref.make(
          new Set<WebSocket>([
            openClient as unknown as WebSocket,
            closedClient as unknown as WebSocket,
          ]),
        );
        const deliveries: Array<{ channel: string; recipients: number }> = [];
        const pushBus = yield* makeServerPushBus({
          clients,
          logOutgoingPush: (push, recipients) => {
            deliveries.push({ channel: push.channel, recipients });
          },
        });

        const delivered = yield* pushBus.publishClient(
          closedClient as unknown as WebSocket,
          WS_CHANNELS.serverWelcome,
          {
            cwd: "/tmp/project",
            projectName: "project",
          },
        );
        expect(delivered).toBe(false);

        yield* pushBus.publishAll(WS_CHANNELS.serverConfigUpdated, {
          issues: [],
          providers: [],
        });

        yield* Effect.promise(() => openClient.waitForSentCount(1));
        expect(closedClient.sent).toHaveLength(0);
        const broadcastMessage = openClient.sent[0];
        expect(broadcastMessage).toBeDefined();
        expect(JSON.parse(broadcastMessage!)).toEqual({
          type: "push",
          sequence: 2,
          channel: WS_CHANNELS.serverConfigUpdated,
          data: {
            issues: [],
            providers: [],
          },
        });
        expect(deliveries).toEqual([
          { channel: WS_CHANNELS.serverWelcome, recipients: 0 },
          { channel: WS_CHANNELS.serverConfigUpdated, recipients: 1 },
        ]);
      }),
    ),
  );

  it.live("isolates targeted send failures from later queued publishes", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const healthyBroadcastClient = new MockWebSocket();
        const failingTargetClient = new MockWebSocket();
        failingTargetClient.throwOnSend = true;

        const clients = yield* Ref.make(
          new Set<WebSocket>([healthyBroadcastClient as unknown as WebSocket]),
        );
        const deliveries: Array<{ channel: string; recipients: number }> = [];
        const pushBus = yield* makeServerPushBus({
          clients,
          logOutgoingPush: (push, recipients) => {
            deliveries.push({ channel: push.channel, recipients });
          },
        });

        const delivered = yield* pushBus.publishClient(
          failingTargetClient as unknown as WebSocket,
          WS_CHANNELS.serverWelcome,
          {
            cwd: "/tmp/project",
            projectName: "project",
          },
        );
        expect(delivered).toBe(false);

        yield* pushBus.publishAll(WS_CHANNELS.serverConfigUpdated, {
          issues: [],
          providers: [],
        });

        yield* Effect.promise(() => healthyBroadcastClient.waitForSentCount(1));

        expect(failingTargetClient.sent).toHaveLength(0);
        expect(healthyBroadcastClient.sent).toHaveLength(1);
        const broadcastMessage = healthyBroadcastClient.sent[0];
        expect(broadcastMessage).toBeDefined();
        expect(JSON.parse(broadcastMessage!)).toEqual({
          type: "push",
          sequence: 2,
          channel: WS_CHANNELS.serverConfigUpdated,
          data: {
            issues: [],
            providers: [],
          },
        });
        expect(deliveries).toEqual([
          { channel: WS_CHANNELS.serverWelcome, recipients: 0 },
          { channel: WS_CHANNELS.serverConfigUpdated, recipients: 1 },
        ]);
      }),
    ),
  );
});
