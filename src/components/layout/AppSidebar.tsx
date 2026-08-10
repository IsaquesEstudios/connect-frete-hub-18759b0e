import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { BarChart3, Home, LogOut, MessageSquareText, Package, Settings, Truck, User as UserIcon, Users } from "lucide-react";
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
import { useIsMobile } from "@/hooks/use-mobile";
import type { User } from "@/lib/data";

const ICON_CLASS = "text-white";

export function AppSidebar({ user }: { user: User }) {
  const navigate = useNavigate();
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const isMobile = useIsMobile();
  const home = homeFor(user);

  const items = [
    { title: "Início", url: home, icon: Home },
    { title: "Mensagens rápidas", url: "/mensagens-rapidas", icon: MessageSquareText },
    ...(user.type === "admin"
      ? [
          { title: "Motoristas disponíveis", url: "/motorista/disponivel", icon: Truck },
          { title: "Fretes disponíveis", url: "/fretes/disponivel", icon: Package },
        ]
      : []),
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
                    size={isMobile ? "lg" : "default"}
                    className={isMobile ? "text-base" : undefined}
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
              size={isMobile ? "lg" : "default"}
              className={isMobile ? "text-base" : undefined}
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
              size={isMobile ? "lg" : "default"}
              className={isMobile ? "text-base" : undefined}
            >
              <LogOut className={ICON_CLASS} />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <CollapseToggle isMobile={isMobile} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function CollapseToggle({ isMobile }: { isMobile: boolean }) {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  return (
    <SidebarMenuButton
      tooltip={collapsed ? "Expandir menu" : "Recolher menu"}
      onClick={toggleSidebar}
      size={isMobile ? "lg" : "default"}
      className={isMobile ? "text-base" : undefined}
    >
      {collapsed ? <PanelLeftOpen className={ICON_CLASS} /> : <PanelLeftClose className={ICON_CLASS} />}
      <span>{collapsed ? "Expandir" : "Recolher"}</span>
    </SidebarMenuButton>
  );
}
