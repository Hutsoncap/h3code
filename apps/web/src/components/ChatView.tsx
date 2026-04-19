import { ChatViewControllerShell, type ChatViewProps } from "./chat/ChatViewControllerShell";

export type { ChatViewProps } from "./chat/ChatViewControllerShell";

export default function ChatView(props: ChatViewProps) {
  return <ChatViewControllerShell {...props} />;
}
