#!/usr/bin/env python3
"""Add missing i18n keys to all 9 locale files."""
import json
import os

LOCALES_DIR = os.path.join(os.path.dirname(__file__), '..', 'src', 'i18n', 'locales')

# Translations for each locale
TRANSLATIONS = {
    'auditLogs': {
        'en': {'title': 'Audit Logs', 'subtitle': 'Client-side audit events (session scope)', 'export': 'Export JSON', 'clear': 'Clear', 'search': 'Search audit events...', 'allActions': 'All actions', 'events': '{{count}} events', 'timestamp': 'Timestamp', 'action': 'Action', 'event': 'Event', 'severity': 'Severity', 'empty': 'No audit events recorded in this session'},
        'de': {'title': 'Audit-Logs', 'subtitle': 'Clientseitige Audit-Ereignisse (Sitzungsbereich)', 'export': 'JSON exportieren', 'clear': 'Leeren', 'search': 'Audit-Ereignisse suchen...', 'allActions': 'Alle Aktionen', 'events': '{{count}} Ereignisse', 'timestamp': 'Zeitstempel', 'action': 'Aktion', 'event': 'Ereignis', 'severity': 'Schweregrad', 'empty': 'Keine Audit-Ereignisse in dieser Sitzung aufgezeichnet'},
        'es': {'title': 'Registros de Auditoría', 'subtitle': 'Eventos de auditoría del lado del cliente (ámbito de sesión)', 'export': 'Exportar JSON', 'clear': 'Limpiar', 'search': 'Buscar eventos de auditoría...', 'allActions': 'Todas las acciones', 'events': '{{count}} eventos', 'timestamp': 'Marca de tiempo', 'action': 'Acción', 'event': 'Evento', 'severity': 'Severidad', 'empty': 'No se registraron eventos de auditoría en esta sesión'},
        'fr': {'title': "Journaux d'Audit", 'subtitle': "Événements d'audit côté client (portée de session)", 'export': 'Exporter JSON', 'clear': 'Effacer', 'search': "Rechercher des événements d'audit...", 'allActions': 'Toutes les actions', 'events': '{{count}} événements', 'timestamp': 'Horodatage', 'action': 'Action', 'event': 'Événement', 'severity': 'Gravité', 'empty': "Aucun événement d'audit enregistré dans cette session"},
        'ja': {'title': '監査ログ', 'subtitle': 'クライアント側の監査イベント（セッションスコープ）', 'export': 'JSONエクスポート', 'clear': 'クリア', 'search': '監査イベントを検索...', 'allActions': 'すべてのアクション', 'events': '{{count}}イベント', 'timestamp': 'タイムスタンプ', 'action': 'アクション', 'event': 'イベント', 'severity': '重要度', 'empty': 'このセッションで記録された監査イベントはありません'},
        'zh': {'title': '审计日志', 'subtitle': '客户端审计事件（会话范围）', 'export': '导出 JSON', 'clear': '清除', 'search': '搜索审计事件...', 'allActions': '所有操作', 'events': '{{count}} 个事件', 'timestamp': '时间戳', 'action': '操作', 'event': '事件', 'severity': '严重性', 'empty': '本次会话未记录审计事件'},
        'ru': {'title': 'Журнал аудита', 'subtitle': 'Клиентские события аудита (область сеанса)', 'export': 'Экспорт JSON', 'clear': 'Очистить', 'search': 'Поиск событий аудита...', 'allActions': 'Все действия', 'events': '{{count}} событий', 'timestamp': 'Метка времени', 'action': 'Действие', 'event': 'Событие', 'severity': 'Серьёзность', 'empty': 'В этом сеансе не записано событий аудита'},
        'tr': {'title': 'Denetim Günlükleri', 'subtitle': 'İstemci taraflı denetim olayları (oturum kapsamı)', 'export': "JSON'u dışa aktar", 'clear': 'Temizle', 'search': 'Denetim olaylarını ara...', 'allActions': 'Tüm eylemler', 'events': '{{count}} olay', 'timestamp': 'Zaman damgası', 'action': 'Eylem', 'event': 'Olay', 'severity': 'Önem derecesi', 'empty': 'Bu oturumda denetim olayı kaydedilmedi'},
        'ar': {'title': 'سجلات التدقيق', 'subtitle': 'أحداث التدقيق من جانب العميل (نطاق الجلسة)', 'export': 'تصدير JSON', 'clear': 'مسح', 'search': 'البحث عن أحداث التدقيق...', 'allActions': 'كل الإجراءات', 'events': '{{count}} حدث', 'timestamp': 'الطابع الزمني', 'action': 'الإجراء', 'event': 'الحدث', 'severity': 'الخطورة', 'empty': 'لا توجد أحداث تدقيق مسجلة في هذه الجلسة'},
    },
    'worklists': {
        'en': {'title': 'Worklists', 'subtitle': 'DICOM Modality Worklist Management', 'upload': 'Upload Worklist', 'deleted': 'Worklist deleted', 'deleteFailed': 'Delete failed', 'uploaded': 'Worklist uploaded', 'uploadFailed': 'Upload failed (plugin not installed?)', 'pluginNotInstalled': 'Worklists plugin not installed. Install the Orthanc Worklists plugin to use this feature.', 'count': '{{count}} worklists', 'empty': 'No worklists found', 'actions': 'Actions', 'type': 'Type', 'worklist': 'Worklist'},
        'de': {'title': 'Worklists', 'subtitle': 'DICOM Modality Worklist-Verwaltung', 'upload': 'Worklist hochladen', 'deleted': 'Worklist gelöscht', 'deleteFailed': 'Löschen fehlgeschlagen', 'uploaded': 'Worklist hochgeladen', 'uploadFailed': 'Upload fehlgeschlagen (Plugin nicht installiert?)', 'pluginNotInstalled': 'Worklists-Plugin nicht installiert. Installieren Sie das Orthanc Worklists-Plugin, um diese Funktion zu nutzen.', 'count': '{{count}} Worklists', 'empty': 'Keine Worklists gefunden', 'actions': 'Aktionen', 'type': 'Typ', 'worklist': 'Worklist'},
        'es': {'title': 'Listas de trabajo', 'subtitle': 'Gestión de listas de trabajo de modalidad DICOM', 'upload': 'Subir lista de trabajo', 'deleted': 'Lista de trabajo eliminada', 'deleteFailed': 'Error al eliminar', 'uploaded': 'Lista de trabajo subida', 'uploadFailed': 'Error al subir (¿plugin no instalado?)', 'pluginNotInstalled': 'Plugin de listas de trabajo no instalado. Instale el plugin de Orthanc Worklists para usar esta función.', 'count': '{{count}} listas de trabajo', 'empty': 'No se encontraron listas de trabajo', 'actions': 'Acciones', 'type': 'Tipo', 'worklist': 'Lista de trabajo'},
        'fr': {'title': "Listes de travail", 'subtitle': 'Gestion des listes de travail de modalité DICOM', 'upload': "Télécharger la liste de travail", 'deleted': "Liste de travail supprimée", 'deleteFailed': "Échec de la suppression", 'uploaded': "Liste de travail téléchargée", 'uploadFailed': "Échec du téléchargement (plugin non installé ?)", 'pluginNotInstalled': "Plugin de listes de travail non installé. Installez le plugin Orthanc Worklists pour utiliser cette fonctionnalité.", 'count': '{{count}} listes de travail', 'empty': 'Aucune liste de travail trouvée', 'actions': 'Actions', 'type': 'Type', 'worklist': 'Liste de travail'},
        'ja': {'title': 'ワークリスト', 'subtitle': 'DICOMモダリティワークリスト管理', 'upload': 'ワークリストをアップロード', 'deleted': 'ワークリストが削除されました', 'deleteFailed': '削除に失敗しました', 'uploaded': 'ワークリストがアップロードされました', 'uploadFailed': 'アップロードに失敗しました（プラグインがインストールされていません？）', 'pluginNotInstalled': 'ワークリストプラグインがインストールされていません。この機能を使用するにはOrthanc Worklistsプラグインをインストールしてください。', 'count': '{{count}}ワークリスト', 'empty': 'ワークリストが見つかりません', 'actions': 'アクション', 'type': 'タイプ', 'worklist': 'ワークリスト'},
        'zh': {'title': '工作列表', 'subtitle': 'DICOM 模态工作列表管理', 'upload': '上传工作列表', 'deleted': '工作列表已删除', 'deleteFailed': '删除失败', 'uploaded': '工作列表已上传', 'uploadFailed': '上传失败（插件未安装？）', 'pluginNotInstalled': '未安装工作列表插件。请安装 Orthanc Worklists 插件以使用此功能。', 'count': '{{count}} 个工作列表', 'empty': '未找到工作列表', 'actions': '操作', 'type': '类型', 'worklist': '工作列表'},
        'ru': {'title': 'Списки работ', 'subtitle': 'Управление списками работ модальности DICOM', 'upload': 'Загрузить список работ', 'deleted': 'Список работ удалён', 'deleteFailed': 'Ошибка удаления', 'uploaded': 'Список работ загружен', 'uploadFailed': 'Ошибка загрузки (плагин не установлен?)', 'pluginNotInstalled': 'Плагин списков работ не установлен. Установите плагин Orthanc Worklists для использования этой функции.', 'count': '{{count}} списков работ', 'empty': 'Списки работ не найдены', 'actions': 'Действия', 'type': 'Тип', 'worklist': 'Список работ'},
        'tr': {'title': 'İş listeleri', 'subtitle': 'DICOM Modality İş Listesi Yönetimi', 'upload': 'İş listesi yükle', 'deleted': 'İş listesi silindi', 'deleteFailed': 'Silme başarısız', 'uploaded': 'İş listesi yüklendi', 'uploadFailed': 'Yükleme başarısız (eklenti yüklü değil?)', 'pluginNotInstalled': 'İş listeleri eklentisi yüklü değil. Bu özelliği kullanmak için Orthanc Worklists eklentisini yükleyin.', 'count': '{{count}} iş listesi', 'empty': 'İş listesi bulunamadı', 'actions': 'Eylemler', 'type': 'Tür', 'worklist': 'İş listesi'},
        'ar': {'title': 'قوائم العمل', 'subtitle': 'إدارة قائمة عمل نمط DICOM', 'upload': 'تحميل قائمة العمل', 'deleted': 'تم حذف قائمة العمل', 'deleteFailed': 'فشل الحذف', 'uploaded': 'تم تحميل قائمة العمل', 'uploadFailed': 'فشل التحميل (البرنامج المساعد غير مثبت؟)', 'pluginNotInstalled': 'برنامج قوائم العمل غير مثبت. قم بتثبيت برنامج Orthanc Worklists لاستخدام هذه الميزة.', 'count': '{{count}} قوائم عمل', 'empty': 'لم يتم العثور على قوائم عمل', 'actions': 'إجراءات', 'type': 'النوع', 'worklist': 'قائمة العمل'},
    },
}

# Keys to add to studyList.columns
STUDYLIST_COLUMNS_KEYS = {
    'en': {'config': 'Columns', 'toggle': 'Toggle columns', 'view': 'View'},
    'de': {'config': 'Spalten', 'toggle': 'Spalten umschalten', 'view': 'Ansicht'},
    'es': {'config': 'Columnas', 'toggle': 'Alternar columnas', 'view': 'Ver'},
    'fr': {'config': 'Colonnes', 'toggle': 'Basculer les colonnes', 'view': 'Voir'},
    'ja': {'config': '列', 'toggle': '列の切り替え', 'view': '表示'},
    'zh': {'config': '列', 'toggle': '切换列', 'view': '查看'},
    'ru': {'config': 'Столбцы', 'toggle': 'Переключить столбцы', 'view': 'Просмотр'},
    'tr': {'config': 'Sütunlar', 'toggle': 'Sütunları değiştir', 'view': 'Görüntüle'},
    'ar': {'config': 'الأعمدة', 'toggle': 'تبديل الأعمدة', 'view': 'عرض'},
}

# Keys to add to studyList (top-level)
STUDYLIST_KEYS = {
    'en': {'labels': 'Labels', 'labelModeAny': 'OR', 'labelModeAll': 'AND', 'withoutLabels': 'Without labels'},
    'de': {'labels': 'Labels', 'labelModeAny': 'ODER', 'labelModeAll': 'UND', 'withoutLabels': 'Ohne Labels'},
    'es': {'labels': 'Etiquetas', 'labelModeAny': 'O', 'labelModeAll': 'Y', 'withoutLabels': 'Sin etiquetas'},
    'fr': {'labels': 'Étiquettes', 'labelModeAny': 'OU', 'labelModeAll': 'ET', 'withoutLabels': 'Sans étiquettes'},
    'ja': {'labels': 'ラベル', 'labelModeAny': 'いずれか', 'labelModeAll': 'すべて', 'withoutLabels': 'ラベルなし'},
    'zh': {'labels': '标签', 'labelModeAny': '或', 'labelModeAll': '与', 'withoutLabels': '无标签'},
    'ru': {'labels': 'Метки', 'labelModeAny': 'ИЛИ', 'labelModeAll': 'И', 'withoutLabels': 'Без меток'},
    'tr': {'labels': 'Etiketler', 'labelModeAny': 'VEYA', 'labelModeAll': 'VE', 'withoutLabels': 'Etiketsiz'},
    'ar': {'labels': 'العلامات', 'labelModeAny': 'أو', 'labelModeAll': 'و', 'withoutLabels': 'بدون علامات'},
}

# Modality tab keys
MODALITY_KEYS = {
    'en': {'health': 'Health', 'name': 'Name', 'aet': 'AET', 'host': 'Host', 'port': 'Port', 'manufacturer': 'Manufacturer', 'lastEcho': 'Last Echo', 'actions': 'Actions', 'echoAll': 'Echo All', 'addModality': 'Add Modality', 'online': 'online', 'offline': 'offline', 'notEchoed': 'Not echoed yet', 'echoSuccess': 'C-ECHO to {{name}} succeeded', 'echoFailed': 'C-ECHO to {{name}} failed', 'deleted': 'Modality "{{name}}" deleted', 'deleteFailed': 'Failed to delete "{{name}}"', 'deleteTitle': 'Delete Modality', 'deleteDescription': 'Remove "{{name}}" from Orthanc? This cannot be undone.', 'noModalities': 'No modalities configured. Click "Add Modality" to add one.', 'summary': 'DICOM modalities configured for C-STORE, C-FIND, and C-MOVE operations.'},
    'de': {'health': 'Status', 'name': 'Name', 'aet': 'AET', 'host': 'Host', 'port': 'Port', 'manufacturer': 'Hersteller', 'lastEcho': 'Letztes Echo', 'actions': 'Aktionen', 'echoAll': 'Alle testen', 'addModality': 'Modalität hinzufügen', 'online': 'online', 'offline': 'offline', 'notEchoed': 'Nicht getestet', 'echoSuccess': 'C-ECHO an {{name}} erfolgreich', 'echoFailed': 'C-ECHO an {{name}} fehlgeschlagen', 'deleted': 'Modalität "{{name}}" gelöscht', 'deleteFailed': 'Löschen von "{{name}}" fehlgeschlagen', 'deleteTitle': 'Modalität löschen', 'deleteDescription': '"{{name}}" aus Orthanc entfernen? Dies kann nicht rückgängig gemacht werden.', 'noModalities': 'Keine Modalitäten konfiguriert. Klicken Sie auf "Modalität hinzufügen" um eine hinzuzufügen.', 'summary': 'DICOM-Modalitäten für C-STORE, C-FIND und C-MOVE Operationen.'},
    'es': {'health': 'Estado', 'name': 'Nombre', 'aet': 'AET', 'host': 'Host', 'port': 'Puerto', 'manufacturer': 'Fabricante', 'lastEcho': 'Último Echo', 'actions': 'Acciones', 'echoAll': 'Probar Todos', 'addModality': 'Añadir Modalidad', 'online': 'en línea', 'offline': 'sin conexión', 'notEchoed': 'No probado', 'echoSuccess': 'C-ECHO a {{name}} exitoso', 'echoFailed': 'C-ECHO a {{name}} falló', 'deleted': 'Modalidad "{{name}}" eliminada', 'deleteFailed': 'Error al eliminar "{{name}}"', 'deleteTitle': 'Eliminar Modalidad', 'deleteDescription': '¿Eliminar "{{name}}" de Orthanc? Esto no se puede deshacer.', 'noModalities': 'No hay modalidades configuradas. Haga clic en "Añadir Modalidad" para añadir una.', 'summary': 'Modalidades DICOM configuradas para operaciones C-STORE, C-FIND y C-MOVE.'},
    'fr': {'health': 'État', 'name': 'Nom', 'aet': 'AET', 'host': 'Hôte', 'port': 'Port', 'manufacturer': 'Fabricant', 'lastEcho': 'Dernier Echo', 'actions': 'Actions', 'echoAll': 'Tester Tout', 'addModality': 'Ajouter Modalité', 'online': 'en ligne', 'offline': 'hors ligne', 'notEchoed': 'Non testé', 'echoSuccess': 'C-ECHO vers {{name}} réussi', 'echoFailed': 'C-ECHO vers {{name}} échoué', 'deleted': 'Modalité "{{name}}" supprimée', 'deleteFailed': 'Échec de suppression de "{{name}}"', 'deleteTitle': 'Supprimer Modalité', 'deleteDescription': 'Supprimer "{{name}}" d\'Orthanc ? Cette action est irréversible.', 'noModalities': 'Aucune modalité configurée. Cliquez sur "Ajouter Modalité" pour en ajouter une.', 'summary': 'Modalités DICOM configurées pour les opérations C-STORE, C-FIND et C-MOVE.'},
    'ja': {'health': '状態', 'name': '名前', 'aet': 'AET', 'host': 'ホスト', 'port': 'ポート', 'manufacturer': 'メーカー', 'lastEcho': '最終Echo', 'actions': 'アクション', 'echoAll': 'すべてテスト', 'addModality': 'モダリティ追加', 'online': 'オンライン', 'offline': 'オフライン', 'notEchoed': '未テスト', 'echoSuccess': '{{name}}へのC-ECHO成功', 'echoFailed': '{{name}}へのC-ECHO失敗', 'deleted': 'モダリティ「{{name}}」を削除しました', 'deleteFailed': '「{{name}}」の削除に失敗しました', 'deleteTitle': 'モダリティ削除', 'deleteDescription': 'Orthancから「{{name}}」を削除します？この操作は取り消せません。', 'noModalities': 'モダリティが設定されていません。「モダリティ追加」をクリックして追加してください。', 'summary': 'C-STORE、C-FIND、C-MOVE操作用に設定されたDICOMモダリティ。'},
    'zh': {'health': '状态', 'name': '名称', 'aet': 'AET', 'host': '主机', 'port': '端口', 'manufacturer': '制造商', 'lastEcho': '最后Echo', 'actions': '操作', 'echoAll': '全部测试', 'addModality': '添加模态', 'online': '在线', 'offline': '离线', 'notEchoed': '未测试', 'echoSuccess': 'C-ECHO 到 {{name}} 成功', 'echoFailed': 'C-ECHO 到 {{name}} 失败', 'deleted': '模态"{{name}}"已删除', 'deleteFailed': '删除"{{name}}"失败', 'deleteTitle': '删除模态', 'deleteDescription': '从 Orthanc 中删除"{{name}}"？此操作不可撤销。', 'noModalities': '未配置模态。点击"添加模态"来添加一个。', 'summary': '为 C-STORE、C-FIND 和 C-MOVE 操作配置的 DICOM 模态。'},
    'ru': {'health': 'Статус', 'name': 'Имя', 'aet': 'AET', 'host': 'Хост', 'port': 'Порт', 'manufacturer': 'Производитель', 'lastEcho': 'Последний Echo', 'actions': 'Действия', 'echoAll': 'Тестировать все', 'addModality': 'Добавить модальность', 'online': 'онлайн', 'offline': 'офлайн', 'notEchoed': 'Не тестировалось', 'echoSuccess': 'C-ECHO к {{name}} успешен', 'echoFailed': 'C-ECHO к {{name}} не удался', 'deleted': 'Модальность "{{name}}" удалена', 'deleteFailed': 'Ошибка удаления "{{name}}"', 'deleteTitle': 'Удалить модальность', 'deleteDescription': 'Удалить "{{name}}" из Orthanc? Это действие необратимо.', 'noModalities': 'Модальности не настроены. Нажмите "Добавить модальность" чтобы добавить.', 'summary': 'DICOM-модальности для операций C-STORE, C-FIND и C-MOVE.'},
    'tr': {'health': 'Durum', 'name': 'Ad', 'aet': 'AET', 'host': 'Sunucu', 'port': 'Port', 'manufacturer': 'Üretici', 'lastEcho': 'Son Echo', 'actions': 'Eylemler', 'echoAll': 'Tümünü Test Et', 'addModality': 'Modalite Ekle', 'online': 'çevrimiçi', 'offline': 'çevrimdışı', 'notEchoed': 'Test edilmedi', 'echoSuccess': '{{name}} için C-ECHO başarılı', 'echoFailed': '{{name}} için C-ECHO başarısız', 'deleted': 'Modalite "{{name}}" silindi', 'deleteFailed': '"{{name}}" silinemedi', 'deleteTitle': 'Modalite Sil', 'deleteDescription': '"{{name}}" Orthanc\'tan kaldırılsın mı? Bu geri alınamaz.', 'noModalities': 'Modalite yapılandırılmadı. Eklemek için "Modalite Ekle"ye tıklayın.', 'summary': 'C-STORE, C-FIND ve C-MOVE işlemleri için yapılandırılmış DICOM modaliteleri.'},
    'ar': {'health': 'الحالة', 'name': 'الاسم', 'aet': 'AET', 'host': 'المضيف', 'port': 'المنفذ', 'manufacturer': 'الشركة المصنعة', 'lastEcho': 'آخر Echo', 'actions': 'إجراءات', 'echoAll': 'اختبار الكل', 'addModality': 'إضافة نمط', 'online': 'متصل', 'offline': 'غير متصل', 'notEchoed': 'لم يتم الاختبار', 'echoSuccess': 'C-ECHO إلى {{name}} نجح', 'echoFailed': 'C-ECHO إلى {{name}} فشل', 'deleted': 'تم حذف النمط "{{name}}"', 'deleteFailed': 'فشل حذف "{{name}}"', 'deleteTitle': 'حذف النمط', 'deleteDescription': 'إزالة "{{name}}" من Orthanc؟ لا يمكن التراجع عن هذا.', 'noModalities': 'لا توجد أنماط مكونة. انقر على "إضافة نمط" لإضافة واحد.', 'summary': 'أنماط DICOM المكونة لعمليات C-STORE و C-FIND و C-MOVE.'},
}

# DICOMweb tab keys
DICOMWEB_TAB_KEYS = {
    'en': {'status': 'Status', 'url': 'URL', 'auth': 'Auth', 'capabilities': 'Capabilities', 'addServer': 'Add Server', 'connected': 'Connected', 'serverCount': '{{count}} servers', 'noServers': 'No Orthanc DICOMweb servers configured', 'summary': 'Orthanc DICOMweb servers for WADO-RS, QIDO-RS, and STOW-RS operations.', 'extTitle': 'External PACS — QIDO-RS / WADO-RS', 'extDesc': 'Backend-configured DICOMweb endpoints for querying (QIDO-RS) and retrieving (WADO-RS) studies from an external PACS.', 'query': 'Query', 'retrieve': 'Retrieve', 'notConfigured': 'Not configured', 'apiKey': 'API Key', 'noApiKey': 'No API key configured', 'extNotAvailable': 'No external DICOMweb configuration available. These endpoints are managed by your deployment administrator (backend configuration), not in this UI.', 'extFooter': 'QIDO-RS and WADO-RS endpoints are configured server-side by your administrator.', 'testConnection': 'Test connection'},
    'de': {'status': 'Status', 'url': 'URL', 'auth': 'Auth', 'capabilities': 'Funktionen', 'addServer': 'Server hinzufügen', 'connected': 'Verbunden', 'serverCount': '{{count}} Server', 'noServers': 'Keine Orthanc DICOMweb-Server konfiguriert', 'summary': 'Orthanc DICOMweb-Server für WADO-RS, QIDO-RS und STOW-RS Operationen.', 'extTitle': 'Externes PACS — QIDO-RS / WADO-RS', 'extDesc': 'Backend-konfigurierte DICOMweb-Endpunkte für Abfragen (QIDO-RS) und Abruf (WADO-RS) von Studien aus einem externen PACS.', 'query': 'Abfrage', 'retrieve': 'Abruf', 'notConfigured': 'Nicht konfiguriert', 'apiKey': 'API-Schlüssel', 'noApiKey': 'Kein API-Schlüssel konfiguriert', 'extNotAvailable': 'Keine externe DICOMweb-Konfiguration verfügbar. Diese Endpunkte werden von Ihrem Deployment-Administrator verwaltet (Backend-Konfiguration), nicht in dieser UI.', 'extFooter': 'QIDO-RS und WADO-RS Endpunkte werden serverseitig von Ihrem Administrator konfiguriert.', 'testConnection': 'Verbindung testen'},
    'es': {'status': 'Estado', 'url': 'URL', 'auth': 'Auth', 'capabilities': 'Capacidades', 'addServer': 'Añadir Servidor', 'connected': 'Conectado', 'serverCount': '{{count}} servidores', 'noServers': 'No hay servidores DICOMweb de Orthanc configurados', 'summary': 'Servidores DICOMweb de Orthanc para operaciones WADO-RS, QIDO-RS y STOW-RS.', 'extTitle': 'PACS Externo — QIDO-RS / WADO-RS', 'extDesc': 'Endpoints DICOMweb configurados en el backend para consultar (QIDO-RS) y recuperar (WADO-RS) estudios de un PACS externo.', 'query': 'Consulta', 'retrieve': 'Recuperación', 'notConfigured': 'No configurado', 'apiKey': 'Clave API', 'noApiKey': 'Clave API no configurada', 'extNotAvailable': 'No hay configuración DICOMweb externa disponible. Estos endpoints son gestionados por el administrador de despliegue (configuración backend), no en esta UI.', 'extFooter': 'Los endpoints QIDO-RS y WADO-RS se configuran en el servidor por el administrador.', 'testConnection': 'Probar conexión'},
    'fr': {'status': 'Statut', 'url': 'URL', 'auth': 'Auth', 'capabilities': 'Capacités', 'addServer': 'Ajouter Serveur', 'connected': 'Connecté', 'serverCount': '{{count}} serveurs', 'noServers': 'Aucun serveur DICOMweb Orthanc configuré', 'summary': 'Serveurs DICOMweb Orthanc pour les opérations WADO-RS, QIDO-RS et STOW-RS.', 'extTitle': 'PACS Externe — QIDO-RS / WADO-RS', 'extDesc': "Points de terminaison DICOMweb configurés backend pour interroger (QIDO-RS) et récupérer (WADO-RS) des études d'un PACS externe.", 'query': 'Requête', 'retrieve': 'Récupération', 'notConfigured': 'Non configuré', 'apiKey': 'Clé API', 'noApiKey': 'Clé API non configurée', 'extNotAvailable': "Aucune configuration DICOMweb externe disponible. Ces points de terminaison sont gérés par l'administrateur de déploiement (configuration backend), pas dans cette UI.", 'extFooter': "Les points de terminaison QIDO-RS et WADO-RS sont configurés côté serveur par l'administrateur.", 'testConnection': 'Tester la connexion'},
    'ja': {'status': 'ステータス', 'url': 'URL', 'auth': '認証', 'capabilities': '機能', 'addServer': 'サーバー追加', 'connected': '接続済み', 'serverCount': '{{count}}サーバー', 'noServers': 'Orthanc DICOMwebサーバーが設定されていません', 'summary': 'WADO-RS、QIDO-RS、STOW-RS操作用のOrthanc DICOMwebサーバー。', 'extTitle': '外部PACS — QIDO-RS / WADO-RS', 'extDesc': '外部PACSからのクエリ（QIDO-RS）と取得（WADO-RS）のためのバックエンド設定DICOMwebエンドポイント。', 'query': 'クエリ', 'retrieve': '取得', 'notConfigured': '未設定', 'apiKey': 'APIキー', 'noApiKey': 'APIキーが設定されていません', 'extNotAvailable': '外部DICOMweb設定が利用できません。これらのエンドポイントはデプロイ管理者（バックエンド設定）によって管理され、このUIでは管理されません。', 'extFooter': 'QIDO-RSおよびWADO-RSエンドポイントは管理者によってサーバー側で設定されます。', 'testConnection': '接続テスト'},
    'zh': {'status': '状态', 'url': 'URL', 'auth': '认证', 'capabilities': '功能', 'addServer': '添加服务器', 'connected': '已连接', 'serverCount': '{{count}} 个服务器', 'noServers': '未配置 Orthanc DICOMweb 服务器', 'summary': '用于 WADO-RS、QIDO-RS 和 STOW-RS 操作的 Orthanc DICOMweb 服务器。', 'extTitle': '外部 PACS — QIDO-RS / WADO-RS', 'extDesc': '后端配置的 DICOMweb 端点，用于从外部 PACS 查询 (QIDO-RS) 和检索 (WADO-RS) 研究。', 'query': '查询', 'retrieve': '检索', 'notConfigured': '未配置', 'apiKey': 'API 密钥', 'noApiKey': '未配置 API 密钥', 'extNotAvailable': '无外部 DICOMweb 配置可用。这些端点由部署管理员（后端配置）管理，而非此 UI。', 'extFooter': 'QIDO-RS 和 WADO-RS 端点由管理员在服务器端配置。', 'testConnection': '测试连接'},
    'ru': {'status': 'Статус', 'url': 'URL', 'auth': 'Аутентификация', 'capabilities': 'Возможности', 'addServer': 'Добавить сервер', 'connected': 'Подключено', 'serverCount': '{{count}} серверов', 'noServers': 'Серверы Orthanc DICOMweb не настроены', 'summary': 'Серверы Orthanc DICOMweb для операций WADO-RS, QIDO-RS и STOW-RS.', 'extTitle': 'Внешний PACS — QIDO-RS / WADO-RS', 'extDesc': 'Конечные точки DICOMweb, настроенные в бэкенде, для запроса (QIDO-RS) и получения (WADO-RS) исследований из внешнего PACS.', 'query': 'Запрос', 'retrieve': 'Получение', 'notConfigured': 'Не настроено', 'apiKey': 'API-ключ', 'noApiKey': 'API-ключ не настроен', 'extNotAvailable': 'Внешняя конфигурация DICOMweb недоступна. Эти конечные точки управляются администратором развёртывания (конфигурация бэкенда), а не в этом UI.', 'extFooter': 'Конечные точки QIDO-RS и WADO-RS настраиваются на стороне сервера администратором.', 'testConnection': 'Проверить соединение'},
    'tr': {'status': 'Durum', 'url': 'URL', 'auth': 'Kimlik Doğrulama', 'capabilities': 'Yetenekler', 'addServer': 'Sunucu Ekle', 'connected': 'Bağlı', 'serverCount': '{{count}} sunucu', 'noServers': 'Orthanc DICOMweb sunucusu yapılandırılmadı', 'summary': 'WADO-RS, QIDO-RS ve STOW-RS işlemleri için Orthanc DICOMweb sunucuları.', 'extTitle': 'Harici PACS — QIDO-RS / WADO-RS', 'extDesc': 'Harici bir PACS\'ten çalışma sorgulama (QIDO-RS) ve alma (WADO-RS) için arka uç yapılandırmalı DICOMweb uç noktaları.', 'query': 'Sorgu', 'retrieve': 'Alma', 'notConfigured': 'Yapılandırılmamış', 'apiKey': 'API Anahtarı', 'noApiKey': 'API anahtarı yapılandırılmamış', 'extNotAvailable': 'Harici DICOMweb yapılandırması mevcut değil. Bu uç noktalar dağıtım yöneticiniz (arka uç yapılandırması) tarafından yönetilir, bu UI\'da değil.', 'extFooter': 'QIDO-RS ve WADO-RS uç noktaları yöneticiniz tarafından sunucu tarafında yapılandırılır.', 'testConnection': 'Bağlantıyı test et'},
    'ar': {'status': 'الحالة', 'url': 'URL', 'auth': 'المصادقة', 'capabilities': 'القدرات', 'addServer': 'إضافة خادم', 'connected': 'متصل', 'serverCount': '{{count}} خوادم', 'noServers': 'لم يتم تكوين خوادم Orthanc DICOMweb', 'summary': 'خوادم Orthanc DICOMweb لعمليات WADO-RS و QIDO-RS و STOW-RS.', 'extTitle': 'PACS خارجي — QIDO-RS / WADO-RS', 'extDesc': 'نقاط نهاية DICOMweb المكونة في الخلفية للاستعلام (QIDO-RS) واسترجاع (WADO-RS) الدراسات من PACS خارجي.', 'query': 'استعلام', 'retrieve': 'استرجاع', 'notConfigured': 'غير مكون', 'apiKey': 'مفتاح API', 'noApiKey': 'لم يتم تكوين مفتاح API', 'extNotAvailable': 'لا يتوفر تكوين DICOMweb خارجي. تتم إدارة نقاط النهاية هذه بواسطة مسؤول النشر (تكوين الخلفية)، وليس في هذه الواجهة.', 'extFooter': 'يتم تكوين نقاط نهاية QIDO-RS و WADO-RS من جانب الخادم بواسطة المسؤول.', 'testConnection': 'اختبار الاتصال'},
}

def deep_merge(base, overlay):
    """Recursively merge overlay into base."""
    for key, val in overlay.items():
        if key in base and isinstance(base[key], dict) and isinstance(val, dict):
            deep_merge(base[key], val)
        else:
            base[key] = val

def main():
    for locale_file in os.listdir(LOCALES_DIR):
        if not locale_file.endswith('.json'):
            continue
        locale = locale_file[:-5]  # strip .json
        filepath = os.path.join(LOCALES_DIR, locale_file)
        
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        changed = False
        
        # Add auditLogs
        if locale in TRANSLATIONS.get('auditLogs', {}):
            if 'auditLogs' not in data:
                data['auditLogs'] = {}
            deep_merge(data['auditLogs'], TRANSLATIONS['auditLogs'][locale])
            changed = True
        
        # Add worklists
        if locale in TRANSLATIONS.get('worklists', {}):
            if 'worklists' not in data:
                data['worklists'] = {}
            deep_merge(data['worklists'], TRANSLATIONS['worklists'][locale])
            changed = True
        
        # Add studyList.columns keys
        if locale in STUDYLIST_COLUMNS_KEYS:
            if 'studyList' not in data:
                data['studyList'] = {}
            if 'columns' not in data['studyList']:
                data['studyList']['columns'] = {}
            deep_merge(data['studyList']['columns'], STUDYLIST_COLUMNS_KEYS[locale])
            changed = True
        
        # Add studyList top-level keys
        if locale in STUDYLIST_KEYS:
            if 'studyList' not in data:
                data['studyList'] = {}
            for k, v in STUDYLIST_KEYS[locale].items():
                if k not in data['studyList']:
                    data['studyList'][k] = v
                    changed = True
        
        # Add modality keys
        if locale in MODALITY_KEYS:
            if 'modality' not in data:
                data['modality'] = {}
            deep_merge(data['modality'], MODALITY_KEYS[locale])
            changed = True
        
        # Add dicomweb tab keys
        if locale in DICOMWEB_TAB_KEYS:
            if 'dicomweb' not in data:
                data['dicomweb'] = {}
            deep_merge(data['dicomweb'], DICOMWEB_TAB_KEYS[locale])
            changed = True
        
        if changed:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                f.write('\n')
            print(f'  Updated {locale_file}')
        else:
            print(f'  Skipped {locale_file} (no changes)')

if __name__ == '__main__':
    main()
    print('Done!')
