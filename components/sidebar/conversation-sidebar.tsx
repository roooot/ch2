"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Brain,
  CheckCircle2,
  Command,
  FileJson,
  History,
  KeyRound,
  Link2,
  MessageSquare,
  MessageSquarePlus,
  Rocket,
  Search,
  ShieldCheck,
  Trash2,
  Wrench,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import type { ConversationSummary } from "@/types";

const QUICK_GUIDES = [
  {
    icon: Rocket,
    label: "دیپلوی Next.js",
    prompt: "چطور پروژه Next.js را روی لیارا دیپلوی کنم؟",
  },
  {
    icon: FileJson,
    label: "بررسی liara.json",
    prompt: "فایل liara.json من را بررسی کن و ایرادهای احتمالی را بگو.",
  },
  {
    icon: Wrench,
    label: "عیب‌یابی خطا",
    prompt: "اپلیکیشن من روی لیارا خطا می‌دهد؛ قدم‌به‌قدم کمکم کن عیب‌یابی کنم.",
  },
];

type LiaraConnection = {
  connected: boolean;
  teamId?: string;
  expiresAt?: string;
  lastValidatedAt?: string;
};

function formatExpiry(value?: string) {
  if (!value) return "تا پایان این نشست";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "تا پایان این نشست";

  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function groupConversations(conversations: ConversationSummary[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return conversations.reduce<Record<string, ConversationSummary[]>>((groups, conversation) => {
    const updatedAt = new Date(conversation.updatedAt);
    updatedAt.setHours(0, 0, 0, 0);
    const daysAgo = Math.round((today.getTime() - updatedAt.getTime()) / 86_400_000);
    const label = daysAgo <= 0 ? "امروز" : daysAgo === 1 ? "دیروز" : "گفتگوهای پیشین";
    groups[label] ??= [];
    groups[label].push(conversation);
    return groups;
  }, {});
}

export function ConversationSidebar({
  activeConversationId,
  isClearingMemory,
  onClearMemory,
  onNewChat,
  onQuickPrompt,
  onSelect,
  refreshKey,
}: {
  activeConversationId: string | null;
  isClearingMemory: boolean;
  onClearMemory: () => Promise<void>;
  onNewChat: () => void;
  onQuickPrompt: (prompt: string) => void;
  onSelect: (id: string) => void;
  refreshKey: number;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [memoryDialogOpen, setMemoryDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<ConversationSummary | null>(null);
  const [connectionDialogOpen, setConnectionDialogOpen] = useState(false);
  const [connection, setConnection] = useState<LiaraConnection | null>(null);
  const [isLoadingConnection, setIsLoadingConnection] = useState(true);
  const [isSavingConnection, setIsSavingConnection] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [disconnectConfirmationOpen, setDisconnectConfirmationOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [teamId, setTeamId] = useState("");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionSuccess, setConnectionSuccess] = useState(false);

  const isConnected = Boolean(connection?.connected);

  const loadConnection = useCallback(async (showError = false) => {
    setIsLoadingConnection(true);
    if (showError) setConnectionError(null);

    try {
      const response = await fetch("/api/liara/connection", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load connection");
      const data = (await response.json()) as LiaraConnection;
      setConnection(data);
    } catch {
      setConnection(null);
      if (showError) setConnectionError("وضعیت اتصال در حال حاضر قابل دریافت نیست. دوباره تلاش کنید.");
    } finally {
      setIsLoadingConnection(false);
    }
  }, []);

  useEffect(() => {
    const openCommand = () => setCommandOpen(true);
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
    };

    window.addEventListener("liara:open-command", openCommand);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("liara:open-command", openCommand);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/conversations")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load conversations");
        return response.json();
      })
      .then((data) => {
        if (!cancelled) {
          setConversations(data.conversations ?? []);
          setHasError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setHasError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/liara/connection", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load connection");
        return response.json() as Promise<LiaraConnection>;
      })
      .then((data) => {
        if (!cancelled) setConnection(data);
      })
      .catch(() => {
        if (!cancelled) setConnection(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingConnection(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo(() => groupConversations(conversations), [conversations]);

  const closeMobileSidebar = () => {
    if (isMobile) setOpenMobile(false);
  };

  const startNewChat = () => {
    onNewChat();
    closeMobileSidebar();
  };

  const selectConversation = (id: string) => {
    onSelect(id);
    setCommandOpen(false);
    closeMobileSidebar();
  };

  const selectQuickGuide = (prompt: string) => {
    onQuickPrompt(prompt);
    setCommandOpen(false);
    closeMobileSidebar();
  };

  const deleteConversation = async () => {
    if (!conversationToDelete) return;
    const conversation = conversationToDelete;
    setConversationToDelete(null);

    try {
      const response = await fetch(`/api/conversations?id=${conversation.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete conversation");
      setConversations((current) => current.filter((item) => item.id !== conversation.id));
      if (activeConversationId === conversation.id) onNewChat();
    } catch {
      setHasError(true);
    }
  };

  const handleConnectionDialogChange = (open: boolean) => {
    setConnectionDialogOpen(open);
    if (!open) {
      setApiKey("");
      setConnectionError(null);
      setConnectionSuccess(false);
      return;
    }

    void loadConnection(true);
  };

  const saveConnection = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSavingConnection) return;

    if (!apiKey.trim() || !teamId.trim()) {
      setConnectionSuccess(false);
      setConnectionError("کلید API و شناسهٔ تیم را وارد کنید.");
      return;
    }

    setIsSavingConnection(true);
    setConnectionError(null);
    setConnectionSuccess(false);

    try {
      const response = await fetch("/api/liara/connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim(), teamId: teamId.trim() }),
      });
      if (!response.ok) {
        throw new Error("Could not validate connection");
      }

      const data = (await response.json()) as LiaraConnection;
      setConnection(data);
      setApiKey("");
      setTeamId("");
      setConnectionSuccess(true);
    } catch {
      setConnectionError("کلید API یا شناسهٔ تیم قابل تأیید نیست. اطلاعات را بررسی و دوباره تلاش کنید.");
    } finally {
      setIsSavingConnection(false);
    }
  };

  const disconnect = async () => {
    if (isDisconnecting) return;
    setIsDisconnecting(true);
    setConnectionError(null);

    try {
      const response = await fetch("/api/liara/connection", { method: "DELETE" });
      if (!response.ok) throw new Error("Could not disconnect");
      setConnection(null);
      setConnectionSuccess(false);
      setDisconnectConfirmationOpen(false);
    } catch {
      setConnectionError("قطع اتصال انجام نشد. دوباره تلاش کنید.");
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <>
      <Sidebar side="right" dir="rtl" collapsible="icon" className="border-sidebar-border">
        <SidebarHeader className="gap-3 border-b border-sidebar-border px-3 py-3">
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
              <Rocket aria-hidden="true" />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-semibold">Liara Copilot</p>
              <p className="mt-0.5 text-[11px] text-sidebar-foreground/65">همراه مستندات لیارا</p>
            </div>
          </div>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={startNewChat} tooltip="گفتگوی جدید" variant="outline" size="lg">
                <MessageSquarePlus data-icon="inline-start" />
                <span>گفتگوی جدید</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <Tabs defaultValue="history" className="flex min-h-0 flex-1 flex-col gap-0">
            <TabsList className="mx-3 mt-3 grid grid-cols-2 group-data-[collapsible=icon]:hidden">
              <TabsTrigger value="history">تاریخچه</TabsTrigger>
              <TabsTrigger value="guides">راهنمای سریع</TabsTrigger>
            </TabsList>

            <TabsContent value="history" className="mt-0 min-h-0 flex-1">
              <SidebarGroup className="pt-3">
                <SidebarGroupLabel>
                  <History data-icon="inline-start" />
                  گفتگوهای شما
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  {loading ? (
                    <div className="flex flex-col gap-2 px-2 py-1" aria-label="در حال دریافت تاریخچه">
                      {Array.from({ length: 5 }, (_, index) => (
                        <Skeleton key={index} className="h-8 w-full" />
                      ))}
                    </div>
                  ) : hasError ? (
                    <div className="px-2 py-3 text-xs leading-5 text-sidebar-foreground/70">
                      دریافت تاریخچه ممکن نشد. با باز کردن دوبارهٔ صفحه، دوباره تلاش کنید.
                    </div>
                  ) : conversations.length === 0 ? (
                    <div className="px-2 py-3 text-xs leading-5 text-sidebar-foreground/70">
                      اولین پرسش، اینجا به‌عنوان یک گفتگو ثبت می‌شود.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {Object.entries(groups).map(([label, items]) => (
                        <div key={label} className="flex flex-col gap-1">
                          <p className="px-2 text-[11px] font-medium text-sidebar-foreground/55">{label}</p>
                          <SidebarMenu>
                            {items.map((conversation) => (
                              <SidebarMenuItem key={conversation.id}>
                                <SidebarMenuButton
                                  isActive={activeConversationId === conversation.id}
                                  onClick={() => selectConversation(conversation.id)}
                                  tooltip={conversation.title || "گفتگوی بدون عنوان"}
                                >
                                  <MessageSquare data-icon="inline-start" />
                                  <span>{conversation.title || "گفتگوی بدون عنوان"}</span>
                                </SidebarMenuButton>
                                <SidebarMenuAction
                                  showOnHover
                                  onClick={() => setConversationToDelete(conversation)}
                                  aria-label={`حذف ${conversation.title || "گفتگو"}`}
                                  title="حذف گفتگو"
                                >
                                  <Trash2 aria-hidden="true" />
                                </SidebarMenuAction>
                              </SidebarMenuItem>
                            ))}
                          </SidebarMenu>
                        </div>
                      ))}
                    </div>
                  )}
                </SidebarGroupContent>
              </SidebarGroup>
            </TabsContent>

            <TabsContent value="guides" className="mt-0 min-h-0 flex-1">
              <SidebarGroup className="pt-3">
                <SidebarGroupLabel>
                  <BookOpen data-icon="inline-start" />
                  شروع سریع
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {QUICK_GUIDES.map((guide) => {
                      const Icon = guide.icon;
                      return (
                        <SidebarMenuItem key={guide.label}>
                          <SidebarMenuButton onClick={() => selectQuickGuide(guide.prompt)} tooltip={guide.label}>
                            <Icon data-icon="inline-start" />
                            <span>{guide.label}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </TabsContent>
          </Tabs>
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => setCommandOpen(true)} tooltip="فرمان‌ها">
                <Command data-icon="inline-start" />
                <span>فرمان‌ها</span>
                <Badge variant="outline" className="ms-auto text-[10px] font-normal group-data-[collapsible=icon]:hidden">
                  Ctrl K
                </Badge>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => setMemoryDialogOpen(true)} tooltip="پاک‌کردن حافظه">
                <Brain data-icon="inline-start" />
                <span>پاک‌کردن حافظه</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => handleConnectionDialogChange(true)} tooltip="اتصال حساب لیارا">
                {isConnected ? <Link2 data-icon="inline-start" /> : <KeyRound data-icon="inline-start" />}
                <span>اتصال حساب لیارا</span>
                {isConnected && (
                  <Badge
                    variant="outline"
                    className="ms-auto gap-1 border-emerald-500/35 bg-emerald-500/5 px-1.5 text-[10px] font-normal text-emerald-700 dark:text-emerald-300 group-data-[collapsible=icon]:hidden"
                  >
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-500" />
                    متصل
                  </Badge>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <div className="mt-1 flex items-center justify-between gap-2 px-2 group-data-[collapsible=icon]:justify-center">
            <span className="text-[11px] text-sidebar-foreground/65 group-data-[collapsible=icon]:hidden">نمایش</span>
            <ThemeToggle />
          </div>
        </SidebarFooter>
      </Sidebar>

      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="جست‌وجوی فرمان یا گفتگو…" />
        <CommandList>
          <CommandEmpty>فرمانی یا گفتگویی پیدا نشد.</CommandEmpty>
          <CommandGroup heading="عملیات">
            <CommandItem onSelect={startNewChat}>
              <MessageSquarePlus data-icon="inline-start" />
              گفتگوی جدید
              <CommandShortcut>N</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => { setCommandOpen(false); setMemoryDialogOpen(true); }}>
              <Brain data-icon="inline-start" />
              پاک‌کردن حافظهٔ بین‌گفت‌وگویی
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="گفتگوها">
            {conversations.slice(0, 12).map((conversation) => (
              <CommandItem key={conversation.id} value={conversation.title || conversation.id} onSelect={() => selectConversation(conversation.id)}>
                <Search data-icon="inline-start" />
                {conversation.title || "گفتگوی بدون عنوان"}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <Dialog open={connectionDialogOpen} onOpenChange={handleConnectionDialogChange}>
        <DialogContent dir="rtl" className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto p-5 sm:p-6">
          <DialogHeader className="pe-7 text-start">
            <div className="mb-1 flex items-center gap-2 text-primary">
              <ShieldCheck className="size-5" aria-hidden="true" />
              <DialogTitle>اتصال حساب لیارا</DialogTitle>
            </div>
            <DialogDescription className="leading-6">
              اتصال فقط برای همین نشست نگه‌داری می‌شود. ایجنت صرفاً وضعیت اپلیکیشن و لاگ‌های خطا را می‌خواند و هیچ تغییری در حساب شما ایجاد نمی‌کند.
            </DialogDescription>
          </DialogHeader>

          {isLoadingConnection ? (
            <div className="space-y-3 py-2" aria-label="در حال بررسی اتصال">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-4/5" />
            </div>
          ) : isConnected ? (
            <section className="border-s-2 border-emerald-500/70 bg-muted/45 px-4 py-3" aria-live="polite">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                اتصال فقط‌خواندنی برقرار است
              </div>
              <dl className="mt-3 grid gap-2 text-xs leading-5">
                <div className="flex items-start justify-between gap-4 border-t border-border/70 pt-2">
                  <dt className="shrink-0 text-muted-foreground">شناسهٔ تیم</dt>
                  <dd><bdi dir="ltr" className="font-mono text-[11px] text-foreground">{connection?.teamId ?? "—"}</bdi></dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="shrink-0 text-muted-foreground">اعتبار اتصال</dt>
                  <dd className="text-start text-foreground">{formatExpiry(connection?.expiresAt)}</dd>
                </div>
              </dl>
            </section>
          ) : (
            <form className="space-y-4" onSubmit={saveConnection}>
              <div className="space-y-2">
                <Label htmlFor="liara-api-key">کلید API لیارا</Label>
                <Input
                  id="liara-api-key"
                  type="password"
                  autoComplete="off"
                  dir="ltr"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="کلید API خود را وارد کنید"
                  className="text-left font-mono placeholder:text-right"
                  disabled={isSavingConnection}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="liara-team-id">شناسهٔ تیم</Label>
                <Input
                  id="liara-team-id"
                  type="text"
                  autoComplete="off"
                  dir="ltr"
                  value={teamId}
                  onChange={(event) => setTeamId(event.target.value)}
                  placeholder="Team ID"
                  className="text-left font-mono"
                  disabled={isSavingConnection}
                />
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                کلید پس از اعتبارسنجی نمایش داده نمی‌شود و در مرورگر شما ذخیره نخواهد شد.{" "}
                <a
                  href="https://docs.liara.ir/references/api/about/"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  راهنمای ساخت کلید API
                </a>
              </p>
              {connectionError && (
                <p role="alert" className="border-s-2 border-destructive bg-destructive/5 px-3 py-2 text-xs leading-5 text-destructive">
                  {connectionError}
                </p>
              )}
              <DialogFooter className="gap-2 pt-1 sm:gap-2">
                <Button type="button" variant="outline" onClick={() => handleConnectionDialogChange(false)} disabled={isSavingConnection}>
                  انصراف
                </Button>
                <Button type="submit" disabled={isSavingConnection}>
                  {isSavingConnection ? "در حال بررسی…" : "بررسی و اتصال"}
                </Button>
              </DialogFooter>
            </form>
          )}

          {isConnected && (
            <>
              {connectionError && (
                <p role="alert" className="border-s-2 border-destructive bg-destructive/5 px-3 py-2 text-xs leading-5 text-destructive">
                  {connectionError}
                </p>
              )}
              <DialogFooter className="gap-2 pt-1 sm:gap-2">
                <Button type="button" variant="outline" onClick={() => handleConnectionDialogChange(false)}>
                  بستن
                </Button>
                <Button type="button" variant="destructive" onClick={() => setDisconnectConfirmationOpen(true)} disabled={isDisconnecting}>
                  {isDisconnecting ? "در حال قطع…" : "قطع اتصال"}
                </Button>
              </DialogFooter>
            </>
          )}

          {connectionSuccess && isConnected && (
            <p className="sr-only" role="status">اتصال فقط‌خواندنی با موفقیت برقرار شد.</p>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={memoryDialogOpen} onOpenChange={setMemoryDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حافظهٔ بین‌گفت‌وگویی پاک شود؟</AlertDialogTitle>
            <AlertDialogDescription>
              ترجیحات و خلاصهٔ موضوعات قبلی حذف می‌شوند؛ خود گفتگوهای ثبت‌شده باقی می‌مانند.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              disabled={isClearingMemory}
              onClick={() => void onClearMemory()}
            >
              {isClearingMemory ? "در حال پاک‌سازی…" : "پاک‌کردن حافظه"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={disconnectConfirmationOpen} onOpenChange={setDisconnectConfirmationOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>اتصال حساب لیارا قطع شود؟</AlertDialogTitle>
            <AlertDialogDescription>
              کلید موقت این نشست حذف می‌شود و تا اتصال دوباره، ایجنت به اطلاعات حساب لیارای شما دسترسی نخواهد داشت.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel disabled={isDisconnecting}>انصراف</AlertDialogCancel>
            <AlertDialogAction
              className={cn("bg-destructive text-destructive-foreground hover:bg-destructive/90")}
              disabled={isDisconnecting}
              onClick={() => void disconnect()}
            >
              {isDisconnecting ? "در حال قطع…" : "قطع اتصال"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(conversationToDelete)} onOpenChange={(open) => !open && setConversationToDelete(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>این گفتگو حذف شود؟</AlertDialogTitle>
            <AlertDialogDescription>
              پیام‌ها و منابع این گفتگو دیگر در تاریخچه قابل‌بازیابی نخواهند بود.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction className={cn("bg-destructive text-destructive-foreground hover:bg-destructive/90")} onClick={deleteConversation}>
              حذف گفتگو
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
