/**
 * Ícones usados pelo Quiz Builder (paleta dinâmica + UI) e ImageUpload.
 * Substitui `import * as Icons from "lucide-react"` — que puxava a biblioteca
 * INTEIRA (~600KB) para o chunk — por um mapa tree-shakeável só com o necessário.
 * Ao adicionar um ícone novo na PALETTE/TEMPLATES, inclua-o aqui também.
 */
import {
  Activity, AlertTriangle, AlignCenter, AlignLeft, AlignRight, ArrowLeft,
  BarChart3, BatteryFull, BellRing, ChartLine, ChevronDown, CircleCheck,
  CircleDot, Clapperboard, Clock, Code, Copy, Download, ExternalLink, Eye,
  GalleryHorizontalEnd, Gauge, Gift, GitBranch, GitCompareArrows, GripVertical,
  Image, ImagePlus, Images, LayoutGrid, LayoutTemplate, Link, List, ListChecks,
  Loader, Loader2, MessagesSquare, Minus, Monitor, MousePointerClick, PieChart,
  PlayCircle, Plug, Plus, Quote, Redo2, Ruler, Save, Scale, Search, Share2,
  ShieldCheck, Signal, Smartphone, Sparkles, Square, Tag, ToggleLeft, Trash2,
  Type, Undo2, Upload, UserPlus, Users, Video, Volume2, Wand2, Wifi, X,
} from "lucide-react";

export const Icons = {
  Activity, AlertTriangle, AlignCenter, AlignLeft, AlignRight, ArrowLeft,
  BarChart3, BatteryFull, BellRing, ChartLine, ChevronDown, CircleCheck,
  CircleDot, Clapperboard, Clock, Code, Copy, Download, ExternalLink, Eye,
  GalleryHorizontalEnd, Gauge, Gift, GitBranch, GitCompareArrows, GripVertical,
  Image, ImagePlus, Images, LayoutGrid, LayoutTemplate, Link, List, ListChecks,
  Loader, Loader2, MessagesSquare, Minus, Monitor, MousePointerClick, PieChart,
  PlayCircle, Plug, Plus, Quote, Redo2, Ruler, Save, Scale, Search, Share2,
  ShieldCheck, Signal, Smartphone, Sparkles, Square, Tag, ToggleLeft, Trash2,
  Type, Undo2, Upload, UserPlus, Users, Video, Volume2, Wand2, Wifi, X,
} as const;
