#!/usr/bin/env python3
"""Add shortcuts i18n keys to all 9 locale files."""
import json
import os

LOCALES_DIR = os.path.join(os.path.dirname(__file__), '..', 'src', 'i18n', 'locales')

SHORTCUTS = {
    'en': {
        'nav': {'studies': 'Go to Studies', 'upload': 'Go to Upload', 'activity': 'Go to Activity', 'auditLogs': 'Go to Audit Logs', 'worklists': 'Go to Worklists', 'remoteSources': 'Go to Remote Sources', 'settings': 'Go to Settings'},
        'actions': {'focusSearch': 'Focus search', 'escape': 'Close dialog / deselect', 'export': 'Export data', 'refresh': 'Refresh data', 'new': 'New / Add', 'toggleFilters': 'Toggle filters', 'toggleColumns': 'Toggle columns'},
        'general': {'showHelp': 'Show keyboard shortcuts'},
        'categories': {'navigation': 'Navigation', 'actions': 'Actions', 'general': 'General'},
        'dialogTitle': 'Keyboard Shortcuts',
        'dialogHint': 'Press {key} anywhere to toggle this dialog',
    },
    'de': {
        'nav': {'studies': 'Zu Studien', 'upload': 'Zu Upload', 'activity': 'Zu Aktivität', 'auditLogs': 'Zu Audit-Logs', 'worklists': 'Zu Worklists', 'remoteSources': 'Zu Remote-Quellen', 'settings': 'Zu Einstellungen'},
        'actions': {'focusSearch': 'Suche fokussieren', 'escape': 'Dialog schließen / Auswahl aufheben', 'export': 'Daten exportieren', 'refresh': 'Daten aktualisieren', 'new': 'Neu / Hinzufügen', 'toggleFilters': 'Filter umschalten', 'toggleColumns': 'Spalten umschalten'},
        'general': {'showHelp': 'Tastenkürzel anzeigen'},
        'categories': {'navigation': 'Navigation', 'actions': 'Aktionen', 'general': 'Allgemein'},
        'dialogTitle': 'Tastenkürzel',
        'dialogHint': '{key} überall drücken um diesen Dialog zu öffnen',
    },
    'es': {
        'nav': {'studies': 'Ir a Estudios', 'upload': 'Ir a Carga', 'activity': 'Ir a Actividad', 'auditLogs': 'Ir a Registros de Auditoría', 'worklists': 'Ir a Listas de Trabajo', 'remoteSources': 'Ir a Fuentes Remotas', 'settings': 'Ir a Configuración'},
        'actions': {'focusSearch': 'Enfocar búsqueda', 'escape': 'Cerrar diálogo / deseleccionar', 'export': 'Exportar datos', 'refresh': 'Actualizar datos', 'new': 'Nuevo / Añadir', 'toggleFilters': 'Alternar filtros', 'toggleColumns': 'Alternar columnas'},
        'general': {'showHelp': 'Mostrar atajos de teclado'},
        'categories': {'navigation': 'Navegación', 'actions': 'Acciones', 'general': 'General'},
        'dialogTitle': 'Atajos de Teclado',
        'dialogHint': 'Presiona {key} en cualquier lugar para abrir este diálogo',
    },
    'fr': {
        'nav': {'studies': 'Aller aux Études', 'upload': 'Aller au Téléversement', 'activity': "Aller à l'Activité", 'auditLogs': "Aller aux Journaux d'Audit", 'worklists': 'Aller aux Listes de Travail', 'remoteSources': 'Aller aux Sources Distantes', 'settings': 'Aller aux Paramètres'},
        'actions': {'focusSearch': 'Focus sur la recherche', 'escape': "Fermer le dialogue / désélectionner", 'export': 'Exporter les données', 'refresh': 'Actualiser les données', 'new': 'Nouveau / Ajouter', 'toggleFilters': 'Basculer les filtres', 'toggleColumns': 'Basculer les colonnes'},
        'general': {'showHelp': 'Afficher les raccourcis clavier'},
        'categories': {'navigation': 'Navigation', 'actions': 'Actions', 'general': 'Général'},
        'dialogTitle': 'Raccourcis Clavier',
        'dialogHint': 'Appuyez sur {key} n\'importe où pour ouvrir ce dialogue',
    },
    'ja': {
        'nav': {'studies': '研究へ', 'upload': 'アップロードへ', 'activity': 'アクティビティへ', 'auditLogs': '監査ログへ', 'worklists': 'ワークリストへ', 'remoteSources': 'リモートソースへ', 'settings': '設定へ'},
        'actions': {'focusSearch': '検索にフォーカス', 'escape': 'ダイアログを閉じる / 選択解除', 'export': 'データをエクスポート', 'refresh': 'データを更新', 'new': '新規 / 追加', 'toggleFilters': 'フィルターの切り替え', 'toggleColumns': '列の切り替え'},
        'general': {'showHelp': 'キーボードショートカットを表示'},
        'categories': {'navigation': 'ナビゲーション', 'actions': 'アクション', 'general': '一般'},
        'dialogTitle': 'キーボードショートカット',
        'dialogHint': 'どこでも{key}を押してこのダイアログを開く',
    },
    'zh': {
        'nav': {'studies': '转到研究', 'upload': '转到上传', 'activity': '转到活动', 'auditLogs': '转到审计日志', 'worklists': '转到工作列表', 'remoteSources': '转到远程源', 'settings': '转到设置'},
        'actions': {'focusSearch': '聚焦搜索', 'escape': '关闭对话框 / 取消选择', 'export': '导出数据', 'refresh': '刷新数据', 'new': '新建 / 添加', 'toggleFilters': '切换筛选器', 'toggleColumns': '切换列'},
        'general': {'showHelp': '显示键盘快捷键'},
        'categories': {'navigation': '导航', 'actions': '操作', 'general': '常规'},
        'dialogTitle': '键盘快捷键',
        'dialogHint': '在任何地方按 {key} 打开此对话框',
    },
    'ru': {
        'nav': {'studies': 'К исследованиям', 'upload': 'К загрузке', 'activity': 'К активности', 'auditLogs': 'К журналу аудита', 'worklists': 'К спискам работ', 'remoteSources': 'К удалённым источникам', 'settings': 'К настройкам'},
        'actions': {'focusSearch': 'Фокус на поиск', 'escape': 'Закрыть диалог / снять выделение', 'export': 'Экспорт данных', 'refresh': 'Обновить данные', 'new': 'Новый / Добавить', 'toggleFilters': 'Переключить фильтры', 'toggleColumns': 'Переключить столбцы'},
        'general': {'showHelp': 'Показать горячие клавиши'},
        'categories': {'navigation': 'Навигация', 'actions': 'Действия', 'general': 'Общее'},
        'dialogTitle': 'Горячие клавиши',
        'dialogHint': 'Нажмите {key} где угодно, чтобы открыть этот диалог',
    },
    'tr': {
        'nav': {'studies': 'Çalışmalara git', 'upload': 'Yüklemeye git', 'activity': 'Etkinliğe git', 'auditLogs': 'Denetim Günlüklerine git', 'worklists': 'İş Listelerine git', 'remoteSources': 'Uzak Kaynaklara git', 'settings': 'Ayarlarına git'},
        'actions': {'focusSearch': 'Aramaya odaklan', 'escape': 'Diyalog kapat / seçimi kaldır', 'export': 'Verileri dışa aktar', 'refresh': 'Verileri yenile', 'new': 'Yeni / Ekle', 'toggleFilters': 'Filtreleri değiştir', 'toggleColumns': 'Sütunları değiştir'},
        'general': {'showHelp': 'Klavye kısayollarını göster'},
        'categories': {'navigation': 'Navigasyon', 'actions': 'Eylemler', 'general': 'Genel'},
        'dialogTitle': 'Klavye Kısayolları',
        'dialogHint': 'Bu diyaloğu açmak için herhangi bir yerde {key} tuşuna basın',
    },
    'ar': {
        'nav': {'studies': 'إلى الدراسات', 'upload': 'إلى التحميل', 'activity': 'إلى النشاط', 'auditLogs': 'إلى سجلات التدقيق', 'worklists': 'إلى قوائم العمل', 'remoteSources': 'إلى المصادر البعيدة', 'settings': 'إلى الإعدادات'},
        'actions': {'focusSearch': 'تركيز البحث', 'escape': 'إغلاق الحوار / إلغاء التحديد', 'export': 'تصدير البيانات', 'refresh': 'تحديث البيانات', 'new': 'جديد / إضافة', 'toggleFilters': 'تبديل المرشحات', 'toggleColumns': 'تبديل الأعمدة'},
        'general': {'showHelp': 'إظهار اختصارات لوحة المفاتيح'},
        'categories': {'navigation': 'التنقل', 'actions': 'إجراءات', 'general': 'عام'},
        'dialogTitle': 'اختصارات لوحة المفاتيح',
        'dialogHint': 'اضغط على {key} في أي مكان لفتح هذا الحوار',
    },
}

def main():
    for locale_file in os.listdir(LOCALES_DIR):
        if not locale_file.endswith('.json'):
            continue
        locale = locale_file[:-5]
        if locale not in SHORTCUTS:
            continue
        filepath = os.path.join(LOCALES_DIR, locale_file)
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        data['shortcuts'] = SHORTCUTS[locale]
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write('\n')
        print(f'  Updated {locale_file}')
    print('Done!')

if __name__ == '__main__':
    main()
