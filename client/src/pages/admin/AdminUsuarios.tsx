import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";

const formatCPF = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const validateCPF = (cpf: string): boolean => {
  const cleanCpf = cpf.replace(/\D/g, '');
  
  if (cleanCpf.length !== 11) return false;
  
  if (/^(\d)\1{10}$/.test(cleanCpf)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCpf.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCpf.charAt(9))) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCpf.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCpf.charAt(10))) return false;
  
  return true;
};
import { 
  Download, 
  Upload, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  Calendar,
  Users,
  UserCheck,
  UserX,
  AlertCircle,
  AlertTriangle,
  MoreVertical,
  Edit,
  Trash2,
  Lock,
  Unlock,
  XCircle,
  CheckCircle,
  UserCog,
  Crown,
  Star,
  UserMinus
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UserWithSubscription {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
  createdAt: string | null;
  subscriptionStatus: string | null;
  subscriptionExpiresAt: string | null;
  accountStatus: string | null;
  latestSubscriptionPlan: string | null;
  latestSubscriptionAmount: number | null;
  latestSubscriptionPaidAt: string | null;
  profession?: string | null;
  areaAtuacao?: string | null;
  location?: string | null;
  bio?: string | null;
  isAdmin?: boolean;
  accessPlan?: string | null;
}

interface UsersManagementResponse {
  users: UserWithSubscription[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface CSVFieldMapping {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  subscriptionStatus: string;
  subscriptionExpiresAt: string;
}

export default function AdminUsuarios() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-foreground" data-testid="page-title">Gerenciamento de Usuários</h1>
        <p className="text-muted-foreground">Gerencie todos os usuários e assinaturas da plataforma</p>
      </div>
      <UsersManagement />
    </div>
  );
}

function UsersManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  
  const [activateDialogOpen, setActivateDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithSubscription | null>(null);
  const [expiresAt, setExpiresAt] = useState("");
  const [plan, setPlan] = useState("mensal");
  
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    cpf: "",
    profession: "",
    areaAtuacao: "",
    location: "",
    bio: "",
    isAdmin: false,
    accountStatus: "active",
    subscriptionStatus: "none",
  });
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserWithSubscription | null>(null);
  const [cpfError, setCpfError] = useState<string | null>(null);
  
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [fieldMapping, setFieldMapping] = useState<CSVFieldMapping>({
    name: "name",
    email: "email",
    phone: "phone",
    cpf: "cpf",
    subscriptionStatus: "subscriptionStatus",
    subscriptionExpiresAt: "subscriptionExpiresAt"
  });

  const { data, isLoading, refetch } = useQuery<UsersManagementResponse>({
    queryKey: ["/api/admin/users-management", page, search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "15",
        search,
        status: statusFilter
      });
      const response = await apiRequest("GET", `/api/admin/users-management?${params}`);
      return response.json();
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await apiRequest("PUT", `/api/admin/users/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Usuário atualizado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users-management"] });
      setEditDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar usuário", description: error.message, variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/users/${id}`);
      const data = await res.json();
      return data;
    },
    onSuccess: (data) => {
      toast({ 
        title: "Usuário excluído com sucesso!", 
        description: `${data?.deletedTables?.length || 0} tabelas afetadas` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users-management"] });
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao excluir usuário", 
        description: error?.message || "Ocorreu um erro ao excluir o usuário", 
        variant: "destructive" 
      });
    },
  });

  const deactivateSubscriptionMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("PUT", `/api/admin/users/${userId}/deactivate-subscription`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Assinatura desativada com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users-management"] });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao desativar assinatura", description: error.message, variant: "destructive" });
    },
  });

  const setAccessPlanMutation = useMutation({
    mutationFn: async ({ userId, accessPlan }: { userId: string; accessPlan: string | null }) => {
      await apiRequest("PUT", `/api/admin/users/${userId}`, { accessPlan });
    },
    onSuccess: (_data, variables) => {
      const planLabels: Record<string, string> = {
        full: "Full (Acesso Completo)",
        basic: "Basic (Acesso Intermediário)",
      };
      const label = variables.accessPlan ? planLabels[variables.accessPlan] || variables.accessPlan : "Gratuito";
      toast({ title: `Plano de acesso alterado para: ${label}` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users-management"] });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao alterar plano de acesso", description: error.message, variant: "destructive" });
    },
  });

  const activateSubscriptionMutation = useMutation({
    mutationFn: async ({ userId, expiresAt, plan }: { userId: string; expiresAt: string; plan: string }) => {
      const res = await apiRequest("POST", `/api/admin/users/${userId}/activate-subscription`, { expiresAt, plan });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Assinatura ativada com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users-management"] });
      setActivateDialogOpen(false);
      setSelectedUser(null);
      setExpiresAt("");
    },
    onError: (error: any) => {
      toast({ title: "Erro ao ativar assinatura", description: error.message, variant: "destructive" });
    },
  });

  const importCSVMutation = useMutation({
    mutationFn: async ({ file, fieldMapping }: { file: File; fieldMapping: CSVFieldMapping }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fieldMapping", JSON.stringify(fieldMapping));
      
      const res = await fetch("/api/admin/users/import-csv", {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      
      if (!res.ok) throw new Error("Erro ao importar CSV");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Importação concluída!", 
        description: `${data.success} usuários importados. ${data.errors?.length || 0} erros.` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users-management"] });
      setCsvModalOpen(false);
      setCsvFile(null);
      setCsvHeaders([]);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao importar CSV", description: error.message, variant: "destructive" });
    },
  });

  const handleOpenEditDialog = (user: UserWithSubscription) => {
    setSelectedUser(user);
    setCpfError(null);
    setEditForm({
      name: user.name || "",
      email: user.email || "",
      phone: formatPhone(user.phone || ""),
      cpf: formatCPF(user.cpf || ""),
      profession: user.profession || "",
      areaAtuacao: user.areaAtuacao || "",
      location: user.location || "",
      bio: user.bio || "",
      isAdmin: user.isAdmin || false,
      accountStatus: user.accountStatus || "active",
      subscriptionStatus: user.subscriptionStatus || "none",
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (selectedUser) {
      const cleanCpf = editForm.cpf.replace(/\D/g, '');
      if (cleanCpf && cleanCpf.length > 0) {
        if (cleanCpf.length !== 11) {
          setCpfError("CPF deve ter 11 dígitos");
          toast({ title: "CPF inválido", description: "CPF deve ter 11 dígitos", variant: "destructive" });
          return;
        }
        if (!validateCPF(cleanCpf)) {
          setCpfError("CPF inválido. Verifique os dígitos.");
          toast({ title: "CPF inválido", description: "O CPF informado não é válido", variant: "destructive" });
          return;
        }
      }
      setCpfError(null);
      
      const cleanPhone = editForm.phone.replace(/\D/g, '');
      
      updateUserMutation.mutate({
        id: selectedUser.id,
        data: {
          ...editForm,
          cpf: cleanCpf || null,
          phone: cleanPhone || null,
        },
      });
    }
  };

  const handleToggleBlock = (user: UserWithSubscription) => {
    updateUserMutation.mutate({
      id: user.id,
      data: { accountStatus: user.accountStatus === 'blocked' ? 'active' : 'blocked' },
    });
  };

  const handleOpenDeleteDialog = (user: UserWithSubscription) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (userToDelete) {
      deleteUserMutation.mutate(userToDelete.id);
    }
  };

  const handleOpenActivateDialog = (user: UserWithSubscription) => {
    setSelectedUser(user);
    if (user.subscriptionExpiresAt) {
      setExpiresAt(new Date(user.subscriptionExpiresAt).toISOString().split("T")[0]);
    } else {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      setExpiresAt(nextMonth.toISOString().split("T")[0]);
    }
    setActivateDialogOpen(true);
  };

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleExportCSV = async () => {
    try {
      const response = await apiRequest("GET", "/api/admin/users/export-csv");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `usuarios-lowfy-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({ title: "CSV exportado com sucesso!" });
    } catch (error: any) {
      toast({ title: "Erro ao exportar CSV", description: error.message, variant: "destructive" });
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setCsvFile(file);
    
    const text = await file.text();
    const lines = text.split("\n");
    if (lines.length > 0) {
      const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
      setCsvHeaders(headers);
    }
    
    setCsvModalOpen(true);
  };

  const handleImportCSV = () => {
    if (csvFile) {
      importCSVMutation.mutate({ file: csvFile, fieldMapping });
    }
  };

  const getSubscriptionStatusBadge = (status: string | null) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500 hover:bg-green-600" data-testid="badge-active">Ativa</Badge>;
      case "expired":
        return <Badge variant="destructive" data-testid="badge-expired">Vencida</Badge>;
      case "canceled":
        return <Badge variant="secondary" className="bg-orange-500 text-white hover:bg-orange-600" data-testid="badge-canceled">Cancelada</Badge>;
      case "refunded":
        return <Badge className="bg-red-600 hover:bg-red-700 text-white" data-testid="badge-refunded">Reembolso</Badge>;
      case "none":
      default:
        return <Badge variant="outline" data-testid="badge-none">Sem assinatura</Badge>;
    }
  };

  const getAccountStatusBadge = (status: string | null) => {
    switch (status) {
      case "active":
        return <Badge variant="outline" className="border-green-500 text-green-600">Ativo</Badge>;
      case "blocked":
        return <Badge variant="destructive">Bloqueado</Badge>;
      case "pending":
        return <Badge variant="secondary">Pendente</Badge>;
      default:
        return <Badge variant="outline">-</Badge>;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return "-";
    }
  };

  const users = data?.users || [];
  const pagination = data?.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 };

  const stats = {
    total: pagination.total,
    active: users.filter(u => u.subscriptionStatus === "active").length,
    expired: users.filter(u => u.subscriptionStatus === "expired").length,
    canceled: users.filter(u => u.subscriptionStatus === "canceled").length,
    refunded: users.filter(u => u.subscriptionStatus === "refunded").length,
    none: users.filter(u => !u.subscriptionStatus || u.subscriptionStatus === "none").length,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
                <Users className="h-6 w-6 text-blue-600 dark:text-blue-300" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Usuários</p>
                <p className="text-2xl font-bold" data-testid="stat-total">{pagination.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
                <UserCheck className="h-6 w-6 text-green-600 dark:text-green-300" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ativa</p>
                <p className="text-2xl font-bold text-green-600" data-testid="stat-active">{stats.active}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-100 dark:bg-red-900 rounded-full">
                <UserX className="h-6 w-6 text-red-600 dark:text-red-300" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vencida</p>
                <p className="text-2xl font-bold text-red-600" data-testid="stat-expired">{stats.expired}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-600/10 dark:bg-red-600/20 rounded-full">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Reembolso</p>
                <p className="text-2xl font-bold text-red-600" data-testid="stat-refunded">{stats.refunded}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full">
                <AlertCircle className="h-6 w-6 text-gray-600 dark:text-gray-300" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sem Assinatura</p>
                <p className="text-2xl font-bold text-gray-600" data-testid="stat-none">{stats.none}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <CardTitle>Lista de Usuários</CardTitle>
              <CardDescription>Gerencie usuários e suas assinaturas</CardDescription>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={handleExportCSV}
                data-testid="button-export-csv"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar CSV
              </Button>
              
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-import-csv"
              >
                <Upload className="w-4 h-4 mr-2" />
                Importar CSV
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 flex gap-2">
              <Input
                placeholder="Buscar por nome, email ou telefone..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                data-testid="input-search"
              />
              <Button onClick={handleSearch} data-testid="button-search">
                <Search className="w-4 h-4" />
              </Button>
            </div>
            
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[200px]" data-testid="select-status-filter">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="active">Assinatura Ativa</SelectItem>
                <SelectItem value="expired">Assinatura Vencida</SelectItem>
                <SelectItem value="canceled">Assinatura Cancelada</SelectItem>
                <SelectItem value="refunded">Reembolso</SelectItem>
                <SelectItem value="none">Sem Assinatura</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data Criação</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Status Assinatura</TableHead>
                      <TableHead>Data Assinatura</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell data-testid={`user-created-${user.id}`}>
                          {formatDate(user.createdAt)}
                        </TableCell>
                        <TableCell className="font-medium" data-testid={`user-name-${user.id}`}>
                          <div className="flex items-center gap-2">
                            {user.name}
                            {user.isAdmin && (
                              <Badge variant="secondary" className="text-xs">Admin</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell data-testid={`user-email-${user.id}`}>
                          {user.email}
                        </TableCell>
                        <TableCell data-testid={`user-phone-${user.id}`}>
                          {user.phone || "-"}
                        </TableCell>
                        <TableCell data-testid={`user-subscription-status-${user.id}`}>
                          <div className="flex flex-col gap-1">
                            {getSubscriptionStatusBadge(user.subscriptionStatus)}
                            {user.accountStatus === 'blocked' && (
                              <Badge variant="destructive" className="text-xs">Bloqueado</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell data-testid={`user-subscription-date-${user.id}`}>
                          {formatDate(user.latestSubscriptionPaidAt)}
                        </TableCell>
                        <TableCell data-testid={`user-expiry-${user.id}`}>
                          {formatDate(user.subscriptionExpiresAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                data-testid={`button-actions-${user.id}`}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem
                                onClick={() => handleOpenEditDialog(user)}
                                data-testid={`action-edit-${user.id}`}
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                Editar Usuário
                              </DropdownMenuItem>
                              
                              <DropdownMenuSeparator />
                              
                              <DropdownMenuItem
                                onClick={() => handleOpenActivateDialog(user)}
                                data-testid={`action-activate-${user.id}`}
                              >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Ativar Assinatura
                              </DropdownMenuItem>
                              
                              {user.subscriptionStatus === 'active' && (
                                <DropdownMenuItem
                                  onClick={() => deactivateSubscriptionMutation.mutate(user.id)}
                                  data-testid={`action-deactivate-${user.id}`}
                                >
                                  <XCircle className="w-4 h-4 mr-2" />
                                  Desativar Assinatura
                                </DropdownMenuItem>
                              )}
                              
                              <DropdownMenuSeparator />

                              {/* Opções de Plano de Acesso */}
                              <DropdownMenuItem
                                onClick={() => setAccessPlanMutation.mutate({ userId: user.id, accessPlan: 'full' })}
                                disabled={user.accessPlan === 'full' || setAccessPlanMutation.isPending}
                                data-testid={`action-plan-full-${user.id}`}
                                className={user.accessPlan === 'full' ? 'bg-amber-50' : ''}
                              >
                                <Crown className="w-4 h-4 mr-2 text-amber-500" />
                                Plano Full {user.accessPlan === 'full' && '✓'}
                              </DropdownMenuItem>
                              
                              <DropdownMenuItem
                                onClick={() => setAccessPlanMutation.mutate({ userId: user.id, accessPlan: 'basic' })}
                                disabled={user.accessPlan === 'basic' || setAccessPlanMutation.isPending}
                                data-testid={`action-plan-basic-${user.id}`}
                                className={user.accessPlan === 'basic' ? 'bg-blue-50' : ''}
                              >
                                <Star className="w-4 h-4 mr-2 text-blue-500" />
                                Plano Basic {user.accessPlan === 'basic' && '✓'}
                              </DropdownMenuItem>
                              
                              <DropdownMenuItem
                                onClick={() => setAccessPlanMutation.mutate({ userId: user.id, accessPlan: null })}
                                disabled={!user.accessPlan || setAccessPlanMutation.isPending}
                                data-testid={`action-plan-free-${user.id}`}
                                className={!user.accessPlan ? 'bg-gray-50' : ''}
                              >
                                <UserMinus className="w-4 h-4 mr-2 text-gray-500" />
                                Plano Free {!user.accessPlan && '✓'}
                              </DropdownMenuItem>
                              
                              <DropdownMenuSeparator />
                              
                              <DropdownMenuItem
                                onClick={() => handleToggleBlock(user)}
                                data-testid={`action-block-${user.id}`}
                              >
                                {user.accountStatus === 'blocked' ? (
                                  <>
                                    <Unlock className="w-4 h-4 mr-2" />
                                    Desbloquear Acesso
                                  </>
                                ) : (
                                  <>
                                    <Lock className="w-4 h-4 mr-2" />
                                    Bloquear Acesso
                                  </>
                                )}
                              </DropdownMenuItem>
                              
                              <DropdownMenuSeparator />
                              
                              <DropdownMenuItem
                                onClick={() => handleOpenDeleteDialog(user)}
                                className="text-red-600 focus:text-red-600"
                                data-testid={`action-delete-${user.id}`}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Excluir Usuário
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Mostrando {users.length} de {pagination.total} usuários
                </p>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Anterior
                  </Button>
                  
                  <span className="text-sm px-4" data-testid="pagination-info">
                    Página {pagination.page} de {pagination.totalPages}
                  </span>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                    disabled={page >= pagination.totalPages}
                    data-testid="button-next-page"
                  >
                    Próxima
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="w-5 h-5" />
              Editar Usuário
            </DialogTitle>
            <DialogDescription>
              Edite as informações de {selectedUser?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nome *</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  data-testid="input-edit-name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email *</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                  data-testid="input-edit-email"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Telefone</Label>
                <Input
                  id="edit-phone"
                  value={formatPhone(editForm.phone)}
                  onChange={(e) => {
                    const formatted = formatPhone(e.target.value);
                    setEditForm(prev => ({ ...prev, phone: formatted }));
                  }}
                  placeholder="(00) 00000-0000"
                  data-testid="input-edit-phone"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-cpf">CPF</Label>
                <Input
                  id="edit-cpf"
                  value={formatCPF(editForm.cpf)}
                  onChange={(e) => {
                    const formatted = formatCPF(e.target.value);
                    setEditForm(prev => ({ ...prev, cpf: formatted }));
                    setCpfError(null);
                  }}
                  placeholder="000.000.000-00"
                  className={cpfError ? "border-red-500" : ""}
                  data-testid="input-edit-cpf"
                />
                {cpfError && (
                  <p className="text-xs text-red-500">{cpfError}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-profession">Profissão</Label>
                <Input
                  id="edit-profession"
                  value={editForm.profession}
                  onChange={(e) => setEditForm(prev => ({ ...prev, profession: e.target.value }))}
                  data-testid="input-edit-profession"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-area">Área de Atuação</Label>
                <Input
                  id="edit-area"
                  value={editForm.areaAtuacao}
                  onChange={(e) => setEditForm(prev => ({ ...prev, areaAtuacao: e.target.value }))}
                  data-testid="input-edit-area"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-location">Localização</Label>
                <Input
                  id="edit-location"
                  value={editForm.location}
                  onChange={(e) => setEditForm(prev => ({ ...prev, location: e.target.value }))}
                  data-testid="input-edit-location"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-account-status">Status da Conta</Label>
                <Select 
                  value={editForm.accountStatus} 
                  onValueChange={(v) => setEditForm(prev => ({ ...prev, accountStatus: v }))}
                >
                  <SelectTrigger data-testid="select-edit-account-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="blocked">Bloqueado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-subscription-status">Status da Assinatura</Label>
                <Select 
                  value={editForm.subscriptionStatus} 
                  onValueChange={(v) => setEditForm(prev => ({ ...prev, subscriptionStatus: v }))}
                >
                  <SelectTrigger data-testid="select-edit-subscription-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem Assinatura</SelectItem>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="expired">Expirada</SelectItem>
                    <SelectItem value="canceled">Cancelada</SelectItem>
                    <SelectItem value="refunded">Reembolsada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-is-admin"
                  checked={editForm.isAdmin}
                  onChange={(e) => setEditForm(prev => ({ ...prev, isAdmin: e.target.checked }))}
                  className="h-4 w-4"
                  data-testid="checkbox-edit-admin"
                />
                <Label htmlFor="edit-is-admin">Administrador</Label>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-bio">Bio</Label>
              <Textarea
                id="edit-bio"
                value={editForm.bio}
                onChange={(e) => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
                rows={3}
                data-testid="textarea-edit-bio"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveEdit}
              disabled={updateUserMutation.isPending}
              data-testid="button-save-edit"
            >
              {updateUserMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activate Subscription Dialog */}
      <Dialog open={activateDialogOpen} onOpenChange={setActivateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ativar/Editar Assinatura</DialogTitle>
            <DialogDescription>
              Ativar ou editar a assinatura de {selectedUser?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="plan">Plano</Label>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger data-testid="select-plan">
                  <SelectValue placeholder="Selecione o plano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal">Mensal - R$ 49,70</SelectItem>
                  <SelectItem value="anual">Anual - R$ 497,00</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="expiresAt">Data de Vencimento</Label>
              <Input
                id="expiresAt"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                data-testid="input-expires-at"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => {
                if (selectedUser && expiresAt) {
                  activateSubscriptionMutation.mutate({
                    userId: selectedUser.id,
                    expiresAt,
                    plan
                  });
                }
              }}
              disabled={!expiresAt || activateSubscriptionMutation.isPending}
              data-testid="button-confirm-activate"
            >
              {activateSubscriptionMutation.isPending ? "Ativando..." : "Ativar Assinatura"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Excluir Usuário
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Tem certeza que deseja excluir o usuário <strong>{userToDelete?.name}</strong>?</p>
              <p className="text-red-600 font-medium">
                Esta ação é irreversível e excluirá todos os dados relacionados ao usuário, incluindo:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground">
                <li>Assinaturas e pagamentos</li>
                <li>Posts e comentários</li>
                <li>Tópicos e respostas do fórum</li>
                <li>Páginas clonadas</li>
                <li>Saldo de vendedor</li>
                <li>Códigos de afiliado</li>
                <li>Pontos e badges</li>
                <li>Notificações</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? "Excluindo..." : "Sim, Excluir Usuário"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CSV Import Dialog */}
      <Dialog open={csvModalOpen} onOpenChange={setCsvModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar CSV</DialogTitle>
            <DialogDescription>
              Mapeie as colunas do seu arquivo CSV para os campos do sistema
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Arquivo: <span className="font-medium">{csvFile?.name}</span>
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Campo: Nome *</Label>
                <Select 
                  value={fieldMapping.name} 
                  onValueChange={(v) => setFieldMapping(prev => ({ ...prev, name: v }))}
                >
                  <SelectTrigger data-testid="select-map-name">
                    <SelectValue placeholder="Selecione coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    {csvHeaders.map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Campo: Email *</Label>
                <Select 
                  value={fieldMapping.email} 
                  onValueChange={(v) => setFieldMapping(prev => ({ ...prev, email: v }))}
                >
                  <SelectTrigger data-testid="select-map-email">
                    <SelectValue placeholder="Selecione coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    {csvHeaders.map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Campo: Telefone</Label>
                <Select 
                  value={fieldMapping.phone} 
                  onValueChange={(v) => setFieldMapping(prev => ({ ...prev, phone: v }))}
                >
                  <SelectTrigger data-testid="select-map-phone">
                    <SelectValue placeholder="Selecione coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {csvHeaders.map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Campo: CPF</Label>
                <Select 
                  value={fieldMapping.cpf} 
                  onValueChange={(v) => setFieldMapping(prev => ({ ...prev, cpf: v }))}
                >
                  <SelectTrigger data-testid="select-map-cpf">
                    <SelectValue placeholder="Selecione coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {csvHeaders.map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCsvModalOpen(false); setCsvFile(null); setCsvHeaders([]); }}>
              Cancelar
            </Button>
            <Button 
              onClick={handleImportCSV}
              disabled={importCSVMutation.isPending}
              data-testid="button-confirm-import"
            >
              {importCSVMutation.isPending ? "Importando..." : "Importar Usuários"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
