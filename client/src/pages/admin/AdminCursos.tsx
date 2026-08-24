import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Plus, Edit, Trash, RefreshCw, ChevronLeft, ChevronRight,
  GraduationCap, BookOpen, CheckCircle2, Sparkles, Flame,
} from "lucide-react";
import {
  insertCourseSchema,
  type InsertCourse,
  type Course,
} from "@shared/schema";
import {
  AdminPage, AdminPageHeader, StatCard, StatGrid, TableCard, EmptyState,
  TableSkeleton, StatusBadge, FilterBar, formatNumber,
} from "@/components/admin";

export default function AdminCursos() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const { data: courses, isLoading } = useQuery<Course[]>({
    queryKey: ["/api/courses"],
  });

  const filteredCourses = useMemo(() => {
    if (!courses) return [];
    if (!searchTerm.trim()) return courses;
    const term = searchTerm.toLowerCase();
    return courses.filter(course =>
      course.title.toLowerCase().includes(term) ||
      course.description?.toLowerCase().includes(term) ||
      course.category?.toLowerCase().includes(term)
    );
  }, [courses, searchTerm]);

  const totalItems = filteredCourses.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedCourses = filteredCourses.slice(startIndex, endIndex);

  const stats = useMemo(() => {
    const list = courses || [];
    return {
      total: list.length,
      active: list.filter(c => c.isActive).length,
      popular: list.filter(c => c.isPopular).length,
      lessons: list.reduce((sum, c) => sum + (c.lessonCount || 0), 0),
    };
  }, [courses]);

  const form = useForm<InsertCourse>({
    resolver: zodResolver(insertCourseSchema),
    defaultValues: {
      title: "",
      description: "",
      duration: "",
      lessonCount: 0,
      thumbnailUrl: "",
      courseUrl: "",
      isActive: true,
      isNew: false,
      isPopular: false,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertCourse) => {
      await apiRequest("POST", "/api/courses", data);
    },
    onSuccess: () => {
      toast({ title: "Curso criado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar curso", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InsertCourse }) => {
      await apiRequest("PUT", `/api/courses/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Curso atualizado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      setIsDialogOpen(false);
      setEditingCourse(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar curso", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/courses/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Curso excluído com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao excluir curso", description: error.message, variant: "destructive" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/sync/courses", {});
      return response;
    },
    onSuccess: (data: any) => {
      toast({
        title: "Sincronização concluída!",
        description: `${data.coursesCount} cursos sincronizados do Google Drive`
      });
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao sincronizar cursos",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const openDialog = (course?: Course) => {
    if (course) {
      setEditingCourse(course);
      form.reset({
        title: course.title,
        description: course.description || "",
        duration: course.duration || "",
        lessonCount: course.lessonCount || 0,
        thumbnailUrl: course.thumbnailUrl || "",
        courseUrl: course.courseUrl,
        isActive: course.isActive,
        isNew: course.isNew,
        isPopular: course.isPopular,
      });
    } else {
      setEditingCourse(null);
      form.reset();
    }
    setIsDialogOpen(true);
  };

  const onSubmit = (data: InsertCourse) => {
    if (editingCourse) {
      updateMutation.mutate({ id: editingCourse.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <AdminPage>
      <AdminPageHeader
        title="Gestão de cursos"
        description="Crie, edite e sincronize os cursos disponíveis na plataforma"
        icon={GraduationCap}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              data-testid="button-sync-courses"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              {syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar do Drive'}
            </Button>
            <Button size="sm" onClick={() => openDialog()} data-testid="button-create-course">
              <Plus className="w-4 h-4 mr-2" />
              Novo curso
            </Button>
          </>
        }
      />

      <StatGrid cols={4}>
        <StatCard
          label="Cursos"
          value={formatNumber(stats.total)}
          icon={GraduationCap}
          tone="info"
          loading={isLoading}
          testId="stat-total-courses"
        />
        <StatCard
          label="Ativos"
          value={formatNumber(stats.active)}
          icon={CheckCircle2}
          tone="success"
          loading={isLoading}
          testId="stat-active-courses"
        />
        <StatCard
          label="Populares"
          value={formatNumber(stats.popular)}
          icon={Flame}
          tone="warning"
          loading={isLoading}
          testId="stat-popular-courses"
        />
        <StatCard
          label="Aulas no total"
          value={formatNumber(stats.lessons)}
          icon={BookOpen}
          tone="violet"
          loading={isLoading}
          testId="stat-total-lessons"
        />
      </StatGrid>

      <FilterBar
        search={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar cursos por título, descrição ou categoria..."
        trailing={
          <span className="text-sm text-muted-foreground whitespace-nowrap" data-testid="text-total-courses">
            {totalItems} {totalItems === 1 ? 'curso' : 'cursos'}
          </span>
        }
      />

      <TableCard
        title="Cursos"
        count={totalItems}
        footer={totalPages > 1 ? (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
            <span className="text-sm text-muted-foreground" data-testid="text-page-info">
              Mostrando {startIndex + 1} a {Math.min(endIndex, totalItems)} de {totalItems} itens
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                data-testid="button-prev-page"
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </Button>
              {currentPage > 3 && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(1)} className="w-8 h-8 p-0" data-testid="button-page-1">
                    1
                  </Button>
                  {currentPage > 4 && <span className="px-1 text-muted-foreground">...</span>}
                </>
              )}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => page >= currentPage - 2 && page <= currentPage + 2)
                .map(page => (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className="w-8 h-8 p-0"
                    data-testid={`button-page-${page}`}
                  >
                    {page}
                  </Button>
                ))}
              {currentPage < totalPages - 2 && (
                <>
                  {currentPage < totalPages - 3 && <span className="px-1 text-muted-foreground">...</span>}
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(totalPages)} className="w-8 h-8 p-0" data-testid={`button-page-${totalPages}`}>
                    {totalPages}
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                data-testid="button-next-page"
              >
                Próxima
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : undefined}
      >
        {isLoading ? (
          <TableSkeleton />
        ) : paginatedCourses.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="Nenhum curso encontrado"
            description={searchTerm ? "Ajuste o termo da busca." : "Crie um curso ou sincronize do Google Drive."}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Curso</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead className="text-right">Aulas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right pr-4">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedCourses.map((course) => (
                <TableRow key={course.id}>
                  <TableCell data-testid={`course-title-${course.id}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="font-medium truncate max-w-[320px]">{course.title}</p>
                      {course.isNew && <StatusBadge tone="info">Novo</StatusBadge>}
                      {course.isPopular && <StatusBadge tone="warning">Popular</StatusBadge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground" data-testid={`course-duration-${course.id}`}>{course.duration || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums" data-testid={`course-lessons-${course.id}`}>{course.lessonCount}</TableCell>
                  <TableCell>
                    {course.isActive ? (
                      <StatusBadge tone="success" dot data-testid={`course-status-${course.id}`}>Ativo</StatusBadge>
                    ) : (
                      <StatusBadge tone="neutral" dot data-testid={`course-status-${course.id}`}>Inativo</StatusBadge>
                    )}
                  </TableCell>
                  <TableCell className="text-right pr-2 space-x-1 whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => openDialog(course)} data-testid={`button-edit-course-${course.id}`}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => deleteMutation.mutate(course.id)}
                      data-testid={`button-delete-course-${course.id}`}
                    >
                      <Trash className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableCard>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingCourse ? "Editar curso" : "Novo curso"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-course-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea {...field} data-testid="input-course-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duração</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-course-duration" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lessonCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de aulas</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} data-testid="input-course-lesson-count" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="courseUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL do curso</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-course-url" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="thumbnailUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL da thumbnail (opcional)</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-course-thumbnail" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex flex-wrap gap-6 p-3 bg-muted rounded-lg">
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-course-active" />
                      </FormControl>
                      <FormLabel className="!mt-0">Ativo</FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isNew"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-course-new" />
                      </FormControl>
                      <FormLabel className="!mt-0">Novo</FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isPopular"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-course-popular" />
                      </FormControl>
                      <FormLabel className="!mt-0">Popular</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit-course"
                >
                  {editingCourse ? "Atualizar" : "Criar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}
