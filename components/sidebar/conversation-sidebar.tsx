"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Brain,
  Command,
  FileJson,
  History,
  MessageSquare,
  MessageSquarePlus,
  Rocket,
  Search,
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
import { Skeleton } from "@/components/ui/skeleton";
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
