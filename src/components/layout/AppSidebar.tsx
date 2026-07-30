import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { BarChart3, Home, LogOut, MessageSquareText, Settings, User as UserIcon, Users } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { logout } from "@/lib/auth/session";
import { homeFor } from "@/lib/auth/session";
import type { User } from "@/lib/data";

const ICON_CLASS = "text-white";

export function AppSidebar({ user }: { user: User }) {
  const navigate = useNavigate();
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const home = homeFor(user);

  const items = [
    { title: "Início", url: home, icon: Home },
    { title: "Mensagens rápidas", url: "/mensagens-rapidas", icon: MessageSquareText },
    ...(user.type === "admin" ? [{ title: "Usuários", url: "/usuarios", icon: Users }] : []),
    ...(user.type === "admin" ? [{ title: "Métricas", url: "/metricas", icon: BarChart3 }] : []),
    ...(user.type !== "colaborador"
      ? [{ title: "Configurações", url: "/configuracoes", icon: Settings }]
      : []),
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={currentPath === item.url}
                    tooltip={item.title}
                  >
                    <Link to={item.url as "/admin"}>
                      <item.icon className={ICON_CLASS} />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={currentPath === "/perfil"}
              tooltip="Perfil"
            >
              <Link to="/perfil">
                <UserIcon className={ICON_CLASS} />
                <span>Perfil</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sair"
              onClick={async () => {
                await logout();
                navigate({ to: "/auth" });
              }}
            >
              <LogOut className={ICON_CLASS} />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <CollapseToggle />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function CollapseToggle() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  return (
    <SidebarMenuButton
      tooltip={collapsed ? "Expandir menu" : "Recolher menu"}
      onClick={toggleSidebar}
    >
      {collapsed ? <PanelLeftOpen className={ICON_CLASS} /> : <PanelLeftClose className={ICON_CLASS} />}
      <span>{collapsed ? "Expandir" : "Recolher"}</span>
    </SidebarMenuButton>
  );
}
