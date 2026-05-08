import { Language } from './translations';

export type ContentBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] };

export type Section = {
  heading: string;
  content: ContentBlock[];
};

export type LegalDoc = {
  title: string;
  intro?: string;
  sections: Section[];
  contact?: string;
  effectiveDate: string;
};

export const privacyPolicy: Record<Language, LegalDoc> = {
  ko: {
    title: '개인정보 처리방침',
    intro: "본 방침은 'LAON'(이하 '앱')이 사용자의 개인정보를 어떻게 수집, 사용 및 보호하는지 설명합니다.",
    sections: [
      {
        heading: '1. 수집하는 개인정보 항목',
        content: [
          { type: 'paragraph', text: '앱은 서비스 제공을 위해 다음과 같은 최소한의 개인정보를 수집합니다.' },
          { type: 'list', items: [
            '이메일 주소, 이름, 프로필 사진 (사용자 식별 및 프로필 설정용)',
            '기기 식별자(Push Token) (푸시 알림 제공용)',
            '사용자가 업로드한 영상 및 사진 (앱 핵심 기능 제공용)',
          ]},
        ],
      },
      {
        heading: '2. 개인정보의 수집 및 이용 목적',
        content: [
          { type: 'list', items: [
            '사용자 인증 및 계정 관리',
            '팀(크루) 공간 생성 및 참여 서비스 제공',
            '댄스 피드백 영상 공유 및 아카이브 저장',
            '중요 공지사항 및 피드백 알림 전달 (푸시 알림)',
          ]},
        ],
      },
      {
        heading: '3. 데이터 보안',
        content: [
          { type: 'paragraph', text: '모든 데이터는 안전한 서버(HTTPS)를 통해 암호화되어 전송되며, 인가되지 않은 접근으로부터 보호됩니다.' },
        ],
      },
      {
        heading: '4. 개인정보의 제3자 제공',
        content: [
          { type: 'paragraph', text: '앱은 사용자의 동의 없이 개인정보를 외부에 제공하지 않습니다. 다만, 법령의 규정에 의거하거나 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우는 예외로 합니다.' },
        ],
      },
      {
        heading: '5. 데이터 삭제 및 탈퇴',
        content: [
          { type: 'paragraph', text: "사용자는 앱 내 설정 메뉴의 '회원 탈퇴' 기능을 통해 언제든지 자신의 계정과 관련 데이터를 삭제할 수 있습니다. 탈퇴 시 수집된 개인정보는 즉시 파기됩니다." },
        ],
      },
      {
        heading: '6. 문의처',
        content: [
          { type: 'paragraph', text: '본 방침에 대한 문의사항은 개발자에게 연락 주시기 바랍니다.' },
        ],
      },
    ],
    contact: 'hjlree@gmail.com',
    effectiveDate: '시행일: 2026년 4월 22일',
  },

  en: {
    title: 'Privacy Policy',
    intro: "This policy explains how 'LAON' (hereinafter 'the App') collects, uses, and protects users' personal information.",
    sections: [
      {
        heading: '1. Information We Collect',
        content: [
          { type: 'paragraph', text: 'The App collects the minimum personal information necessary to provide its services.' },
          { type: 'list', items: [
            'Email address, name, profile photo (for user identification and profile setup)',
            'Device identifier (Push Token) (for push notification delivery)',
            'Videos and photos uploaded by users (for core app functionality)',
          ]},
        ],
      },
      {
        heading: '2. Purpose of Collection and Use',
        content: [
          { type: 'list', items: [
            'User authentication and account management',
            'Creation and participation in team (crew) spaces',
            'Dance feedback video sharing and archive storage',
            'Delivery of important announcements and feedback notifications (push notifications)',
          ]},
        ],
      },
      {
        heading: '3. Data Security',
        content: [
          { type: 'paragraph', text: 'All data is encrypted and transmitted through secure servers (HTTPS), protected from unauthorized access.' },
        ],
      },
      {
        heading: '4. Third-Party Disclosure',
        content: [
          { type: 'paragraph', text: 'The App does not share personal information with third parties without user consent, except as required by applicable law or in response to lawful requests from authorities.' },
        ],
      },
      {
        heading: '5. Data Deletion and Account Withdrawal',
        content: [
          { type: 'paragraph', text: "Users can delete their account and related data at any time through the 'Delete Account' option in the app settings. All personal information is immediately destroyed upon withdrawal." },
        ],
      },
      {
        heading: '6. Contact',
        content: [
          { type: 'paragraph', text: 'For inquiries about this policy, please contact the developer.' },
        ],
      },
    ],
    contact: 'hjlree@gmail.com',
    effectiveDate: 'Effective: April 22, 2026',
  },

  es: {
    title: 'Política de Privacidad',
    intro: "Esta política explica cómo 'LAON' (en adelante 'la App') recopila, utiliza y protege la información personal de los usuarios.",
    sections: [
      {
        heading: '1. Información que Recopilamos',
        content: [
          { type: 'paragraph', text: 'La App recopila la información personal mínima necesaria para proporcionar sus servicios.' },
          { type: 'list', items: [
            'Dirección de correo electrónico, nombre, foto de perfil (para identificación y configuración de perfil)',
            'Identificador de dispositivo (Push Token) (para notificaciones push)',
            'Videos y fotos subidos por los usuarios (para la funcionalidad principal)',
          ]},
        ],
      },
      {
        heading: '2. Propósito de Recopilación y Uso',
        content: [
          { type: 'list', items: [
            'Autenticación de usuarios y gestión de cuentas',
            'Creación y participación en espacios de equipo (crew)',
            'Compartir videos de retroalimentación de baile y almacenamiento en archivo',
            'Envío de anuncios importantes y notificaciones de retroalimentación (notificaciones push)',
          ]},
        ],
      },
      {
        heading: '3. Seguridad de Datos',
        content: [
          { type: 'paragraph', text: 'Todos los datos se cifran y transmiten a través de servidores seguros (HTTPS), protegidos del acceso no autorizado.' },
        ],
      },
      {
        heading: '4. Divulgación a Terceros',
        content: [
          { type: 'paragraph', text: 'La App no comparte información personal con terceros sin el consentimiento del usuario, salvo cuando lo exija la ley aplicable.' },
        ],
      },
      {
        heading: '5. Eliminación de Datos y Baja de Cuenta',
        content: [
          { type: 'paragraph', text: "Los usuarios pueden eliminar su cuenta y datos relacionados en cualquier momento a través de 'Eliminar cuenta' en la configuración. La información personal se destruye inmediatamente al darse de baja." },
        ],
      },
      {
        heading: '6. Contacto',
        content: [
          { type: 'paragraph', text: 'Para consultas sobre esta política, comuníquese con el desarrollador.' },
        ],
      },
    ],
    contact: 'hjlree@gmail.com',
    effectiveDate: 'Vigente desde: 22 de abril de 2026',
  },

  id: {
    title: 'Kebijakan Privasi',
    intro: "Kebijakan ini menjelaskan bagaimana 'LAON' (selanjutnya disebut 'Aplikasi') mengumpulkan, menggunakan, dan melindungi informasi pribadi pengguna.",
    sections: [
      {
        heading: '1. Informasi yang Kami Kumpulkan',
        content: [
          { type: 'paragraph', text: 'Aplikasi mengumpulkan informasi pribadi minimum yang diperlukan untuk menyediakan layanannya.' },
          { type: 'list', items: [
            'Alamat email, nama, foto profil (untuk identifikasi pengguna dan pengaturan profil)',
            'Pengidentifikasi perangkat (Push Token) (untuk pengiriman notifikasi push)',
            'Video dan foto yang diunggah pengguna (untuk fungsionalitas inti aplikasi)',
          ]},
        ],
      },
      {
        heading: '2. Tujuan Pengumpulan dan Penggunaan',
        content: [
          { type: 'list', items: [
            'Autentikasi pengguna dan manajemen akun',
            'Pembuatan dan partisipasi dalam ruang tim (crew)',
            'Berbagi video umpan balik tari dan penyimpanan arsip',
            'Pengiriman pengumuman penting dan notifikasi umpan balik (notifikasi push)',
          ]},
        ],
      },
      {
        heading: '3. Keamanan Data',
        content: [
          { type: 'paragraph', text: 'Semua data dienkripsi dan ditransmisikan melalui server yang aman (HTTPS), dilindungi dari akses tidak sah.' },
        ],
      },
      {
        heading: '4. Pengungkapan kepada Pihak Ketiga',
        content: [
          { type: 'paragraph', text: 'Aplikasi tidak memberikan informasi pribadi kepada pihak ketiga tanpa persetujuan pengguna, kecuali sebagaimana diwajibkan oleh hukum.' },
        ],
      },
      {
        heading: '5. Penghapusan Data dan Penarikan Akun',
        content: [
          { type: 'paragraph', text: "Pengguna dapat menghapus akun dan data terkait kapan saja melalui fitur 'Hapus Akun' di pengaturan aplikasi. Informasi pribadi langsung dihancurkan saat penarikan akun." },
        ],
      },
      {
        heading: '6. Kontak',
        content: [
          { type: 'paragraph', text: 'Untuk pertanyaan tentang kebijakan ini, silakan hubungi pengembang.' },
        ],
      },
    ],
    contact: 'hjlree@gmail.com',
    effectiveDate: 'Berlaku: 22 April 2026',
  },

  ja: {
    title: 'プライバシーポリシー',
    intro: "本ポリシーは、'LAON'（以下「アプリ」）がユーザーの個人情報をどのように収集、使用、保護するかを説明します。",
    sections: [
      {
        heading: '1. 収集する個人情報',
        content: [
          { type: 'paragraph', text: 'アプリはサービス提供に必要な最小限の個人情報を収集します。' },
          { type: 'list', items: [
            'メールアドレス、名前、プロフィール写真（ユーザー識別およびプロフィール設定用）',
            'デバイス識別子（Push Token）（プッシュ通知配信用）',
            'ユーザーがアップロードした動画・写真（アプリの主要機能提供用）',
          ]},
        ],
      },
      {
        heading: '2. 収集・利用目的',
        content: [
          { type: 'list', items: [
            'ユーザー認証およびアカウント管理',
            'チーム（クルー）スペースの作成と参加',
            'ダンスフィードバック動画の共有とアーカイブ保存',
            '重要なお知らせとフィードバック通知の配信（プッシュ通知）',
          ]},
        ],
      },
      {
        heading: '3. データセキュリティ',
        content: [
          { type: 'paragraph', text: 'すべてのデータは安全なサーバー（HTTPS）を通じて暗号化されて送信され、不正アクセスから保護されています。' },
        ],
      },
      {
        heading: '4. 第三者への提供',
        content: [
          { type: 'paragraph', text: 'アプリはユーザーの同意なしに個人情報を第三者に提供しません。ただし、法令の規定に基づく場合は例外です。' },
        ],
      },
      {
        heading: '5. データ削除とアカウント退会',
        content: [
          { type: 'paragraph', text: "ユーザーはアプリ内設定の「アカウント削除」機能からいつでも自分のアカウントと関連データを削除できます。退会時に収集された個人情報は直ちに破棄されます。" },
        ],
      },
      {
        heading: '6. お問い合わせ',
        content: [
          { type: 'paragraph', text: '本ポリシーに関するお問い合わせは開発者にご連絡ください。' },
        ],
      },
    ],
    contact: 'hjlree@gmail.com',
    effectiveDate: '施行日: 2026年4月22日',
  },

  zh: {
    title: '隐私政策',
    intro: '本政策说明「LAON」（以下简称「应用」）如何收集、使用和保护用户的个人信息。',
    sections: [
      {
        heading: '1. 我们收集的个人信息',
        content: [
          { type: 'paragraph', text: '应用收集提供服务所需的最少个人信息。' },
          { type: 'list', items: [
            '电子邮件地址、姓名、头像（用于用户识别和个人资料设置）',
            '设备标识符（推送令牌）（用于推送通知）',
            '用户上传的视频和照片（用于应用核心功能）',
          ]},
        ],
      },
      {
        heading: '2. 收集和使用目的',
        content: [
          { type: 'list', items: [
            '用户身份验证和账户管理',
            '创建和参与团队（小队）空间',
            '舞蹈反馈视频分享和档案存储',
            '重要公告和反馈通知推送（推送通知）',
          ]},
        ],
      },
      {
        heading: '3. 数据安全',
        content: [
          { type: 'paragraph', text: '所有数据均通过安全服务器（HTTPS）加密传输，受到未授权访问的保护。' },
        ],
      },
      {
        heading: '4. 第三方信息披露',
        content: [
          { type: 'paragraph', text: '未经用户同意，应用不向第三方提供个人信息，法律规定的情况除外。' },
        ],
      },
      {
        heading: '5. 数据删除和注销',
        content: [
          { type: 'paragraph', text: '用户可以随时通过应用设置中的"注销账户"功能删除其账户和相关数据。注销时，收集的个人信息将立即销毁。' },
        ],
      },
      {
        heading: '6. 联系方式',
        content: [
          { type: 'paragraph', text: '如有关于本政策的疑问，请联系开发者。' },
        ],
      },
    ],
    contact: 'hjlree@gmail.com',
    effectiveDate: '生效日期：2026年4月22日',
  },

  th: {
    title: 'นโยบายความเป็นส่วนตัว',
    intro: "นโยบายนี้อธิบายวิธีที่ 'LAON' (ต่อไปนี้เรียกว่า 'แอป') เก็บรวบรวม ใช้ และปกป้องข้อมูลส่วนบุคคลของผู้ใช้",
    sections: [
      {
        heading: '1. ข้อมูลที่เราเก็บรวบรวม',
        content: [
          { type: 'paragraph', text: 'แอปเก็บรวบรวมข้อมูลส่วนบุคคลขั้นต่ำที่จำเป็นสำหรับการให้บริการ' },
          { type: 'list', items: [
            'ที่อยู่อีเมล ชื่อ รูปโปรไฟล์ (สำหรับระบุตัวตนและการตั้งค่าโปรไฟล์)',
            'ตัวระบุอุปกรณ์ (Push Token) (สำหรับการแจ้งเตือน push)',
            'วิดีโอและรูปภาพที่ผู้ใช้อัปโหลด (สำหรับฟังก์ชันหลักของแอป)',
          ]},
        ],
      },
      {
        heading: '2. วัตถุประสงค์ในการเก็บรวบรวมและใช้ข้อมูล',
        content: [
          { type: 'list', items: [
            'การยืนยันตัวตนผู้ใช้และการจัดการบัญชี',
            'การสร้างและเข้าร่วมพื้นที่ทีม (crew)',
            'การแชร์วิดีโอฟีดแบ็กการเต้นและการจัดเก็บในคลัง',
            'การส่งประกาศสำคัญและการแจ้งเตือนฟีดแบ็ก (การแจ้งเตือน push)',
          ]},
        ],
      },
      {
        heading: '3. ความปลอดภัยของข้อมูล',
        content: [
          { type: 'paragraph', text: 'ข้อมูลทั้งหมดได้รับการเข้ารหัสและส่งผ่านเซิร์ฟเวอร์ที่ปลอดภัย (HTTPS) และได้รับการปกป้องจากการเข้าถึงโดยไม่ได้รับอนุญาต' },
        ],
      },
      {
        heading: '4. การเปิดเผยข้อมูลแก่บุคคลที่สาม',
        content: [
          { type: 'paragraph', text: 'แอปไม่ให้ข้อมูลส่วนบุคคลแก่บุคคลที่สามโดยไม่ได้รับความยินยอมจากผู้ใช้ ยกเว้นตามที่กฎหมายกำหนด' },
        ],
      },
      {
        heading: '5. การลบข้อมูลและการยกเลิกบัญชี',
        content: [
          { type: 'paragraph', text: "ผู้ใช้สามารถลบบัญชีและข้อมูลที่เกี่ยวข้องได้ตลอดเวลาผ่านฟีเจอร์ 'ลบบัญชี' ในการตั้งค่าแอป ข้อมูลส่วนบุคคลจะถูกทำลายทันทีเมื่อยกเลิกบัญชี" },
        ],
      },
      {
        heading: '6. ติดต่อ',
        content: [
          { type: 'paragraph', text: 'สำหรับข้อสงสัยเกี่ยวกับนโยบายนี้ กรุณาติดต่อนักพัฒนา' },
        ],
      },
    ],
    contact: 'hjlree@gmail.com',
    effectiveDate: 'วันที่มีผลบังคับใช้: 22 เมษายน 2026',
  },
};

export const termsOfService: Record<Language, LegalDoc> = {
  ko: {
    title: '이용약관',
    sections: [
      {
        heading: '제 1 조 (목적)',
        content: [
          { type: 'paragraph', text: "본 약관은 'LAON'(이하 '앱')이 제공하는 댄스 피드백 및 협업 서비스의 이용 조건 및 절차에 관한 사항을 규정함을 목적으로 합니다." },
        ],
      },
      {
        heading: '제 2 조 (서비스의 내용)',
        content: [
          { type: 'paragraph', text: '앱은 사용자에게 다음과 같은 서비스를 제공합니다.' },
          { type: 'list', items: [
            '팀 단위 프라이빗 크루룸 생성 및 참여',
            '댄스 영상 업로드 및 타임스탬프 기반 피드백 작성',
            '동선 편집 및 공유 도구',
            '팀 일정 조율 및 공지사항 관리',
          ]},
        ],
      },
      {
        heading: '제 3 조 (사용자의 의무)',
        content: [
          { type: 'list', items: [
            '사용자는 타인의 저작권을 침해하는 콘텐츠를 게시해서는 안 됩니다.',
            '부적절한 언행이나 커뮤니티 가이드를 위반하는 행위 시 서비스 이용이 제한될 수 있습니다.',
          ]},
        ],
      },
      {
        heading: '제 4 조 (콘텐츠 등급 및 관리)',
        content: [
          { type: 'paragraph', text: '사용자는 자신이 올리는 콘텐츠에 대해 책임을 지며, 앱은 부적절한 콘텐츠에 대해 신고 및 차단 기능을 제공합니다.' },
        ],
      },
      {
        heading: '제 5 조 (유료 서비스)',
        content: [
          { type: 'paragraph', text: '앱은 특정 기능을 유료(Pro 멤버십)로 제공할 수 있으며, 결제 및 환불은 각 스토어(Google Play 등)의 정책을 따릅니다.' },
        ],
      },
    ],
    effectiveDate: '시행일: 2026년 4월 22일',
  },

  en: {
    title: 'Terms of Service',
    sections: [
      {
        heading: 'Article 1 – Purpose',
        content: [
          { type: 'paragraph', text: "These terms govern the conditions and procedures for using the dance feedback and collaboration service provided by 'LAON' (hereinafter 'the App')." },
        ],
      },
      {
        heading: 'Article 2 – Service Content',
        content: [
          { type: 'paragraph', text: 'The App provides users with the following services.' },
          { type: 'list', items: [
            'Creation and participation in private team crew rooms',
            'Dance video upload and timestamp-based feedback',
            'Choreography editing and sharing tools',
            'Team schedule coordination and announcement management',
          ]},
        ],
      },
      {
        heading: 'Article 3 – User Obligations',
        content: [
          { type: 'list', items: [
            "Users must not post content that infringes on others' copyrights.",
            'Service access may be restricted for inappropriate behavior or violations of community guidelines.',
          ]},
        ],
      },
      {
        heading: 'Article 4 – Content Management',
        content: [
          { type: 'paragraph', text: 'Users are responsible for the content they upload. The App provides reporting and blocking features for inappropriate content.' },
        ],
      },
      {
        heading: 'Article 5 – Paid Services',
        content: [
          { type: 'paragraph', text: 'The App may offer certain features as paid (Pro membership). Payments and refunds follow the policies of the respective store (Google Play, etc.).' },
        ],
      },
    ],
    effectiveDate: 'Effective: April 22, 2026',
  },

  es: {
    title: 'Términos de Servicio',
    sections: [
      {
        heading: 'Artículo 1 – Propósito',
        content: [
          { type: 'paragraph', text: "Estos términos regulan las condiciones y procedimientos para usar el servicio de retroalimentación de baile y colaboración proporcionado por 'LAON' (en adelante 'la App')." },
        ],
      },
      {
        heading: 'Artículo 2 – Contenido del Servicio',
        content: [
          { type: 'paragraph', text: 'La App proporciona a los usuarios los siguientes servicios.' },
          { type: 'list', items: [
            'Creación y participación en salas privadas de equipo (crew)',
            'Carga de videos de baile y retroalimentación basada en marcas de tiempo',
            'Herramientas de edición y compartir coreografía',
            'Coordinación de horarios de equipo y gestión de anuncios',
          ]},
        ],
      },
      {
        heading: 'Artículo 3 – Obligaciones del Usuario',
        content: [
          { type: 'list', items: [
            'Los usuarios no deben publicar contenido que infrinja los derechos de autor de otros.',
            'El acceso al servicio puede restringirse por comportamiento inapropiado o violaciones de las pautas de la comunidad.',
          ]},
        ],
      },
      {
        heading: 'Artículo 4 – Gestión de Contenido',
        content: [
          { type: 'paragraph', text: 'Los usuarios son responsables del contenido que suben. La App proporciona funciones de denuncia y bloqueo para contenido inapropiado.' },
        ],
      },
      {
        heading: 'Artículo 5 – Servicios de Pago',
        content: [
          { type: 'paragraph', text: 'La App puede ofrecer ciertas funciones de pago (membresía Pro). Los pagos y reembolsos siguen las políticas de la tienda respectiva (Google Play, etc.).' },
        ],
      },
    ],
    effectiveDate: 'Vigente desde: 22 de abril de 2026',
  },

  id: {
    title: 'Syarat Layanan',
    sections: [
      {
        heading: 'Pasal 1 – Tujuan',
        content: [
          { type: 'paragraph', text: "Syarat-syarat ini mengatur kondisi dan prosedur penggunaan layanan umpan balik tari dan kolaborasi yang disediakan oleh 'LAON' (selanjutnya disebut 'Aplikasi')." },
        ],
      },
      {
        heading: 'Pasal 2 – Konten Layanan',
        content: [
          { type: 'paragraph', text: 'Aplikasi menyediakan layanan berikut kepada pengguna.' },
          { type: 'list', items: [
            'Pembuatan dan partisipasi dalam ruang tim privat (crew)',
            'Pengunggahan video tari dan umpan balik berbasis timestamp',
            'Alat pengeditan dan berbagi koreografi',
            'Koordinasi jadwal tim dan manajemen pengumuman',
          ]},
        ],
      },
      {
        heading: 'Pasal 3 – Kewajiban Pengguna',
        content: [
          { type: 'list', items: [
            'Pengguna tidak boleh memposting konten yang melanggar hak cipta orang lain.',
            'Akses layanan dapat dibatasi untuk perilaku yang tidak pantas atau pelanggaran pedoman komunitas.',
          ]},
        ],
      },
      {
        heading: 'Pasal 4 – Manajemen Konten',
        content: [
          { type: 'paragraph', text: 'Pengguna bertanggung jawab atas konten yang mereka unggah. Aplikasi menyediakan fitur pelaporan dan pemblokiran untuk konten yang tidak pantas.' },
        ],
      },
      {
        heading: 'Pasal 5 – Layanan Berbayar',
        content: [
          { type: 'paragraph', text: 'Aplikasi dapat menawarkan fitur berbayar tertentu (keanggotaan Pro). Pembayaran dan pengembalian dana mengikuti kebijakan toko masing-masing (Google Play, dll.).' },
        ],
      },
    ],
    effectiveDate: 'Berlaku: 22 April 2026',
  },

  ja: {
    title: '利用規約',
    sections: [
      {
        heading: '第1条（目的）',
        content: [
          { type: 'paragraph', text: "本規約は、'LAON'（以下「アプリ」）が提供するダンスフィードバックおよびコラボレーションサービスの利用条件および手続きに関する事項を定めることを目的とします。" },
        ],
      },
      {
        heading: '第2条（サービスの内容）',
        content: [
          { type: 'paragraph', text: 'アプリはユーザーに以下のサービスを提供します。' },
          { type: 'list', items: [
            'チーム単位のプライベートクルールームの作成と参加',
            'ダンス動画のアップロードとタイムスタンプベースのフィードバック作成',
            '動線編集・共有ツール',
            'チームスケジュール調整とお知らせ管理',
          ]},
        ],
      },
      {
        heading: '第3条（ユーザーの義務）',
        content: [
          { type: 'list', items: [
            'ユーザーは他者の著作権を侵害するコンテンツを投稿してはなりません。',
            '不適切な言動やコミュニティガイドラインに違反する行為はサービス利用が制限される場合があります。',
          ]},
        ],
      },
      {
        heading: '第4条（コンテンツの管理）',
        content: [
          { type: 'paragraph', text: 'ユーザーは自分がアップロードするコンテンツに責任を持ち、アプリは不適切なコンテンツに対して報告・ブロック機能を提供します。' },
        ],
      },
      {
        heading: '第5条（有料サービス）',
        content: [
          { type: 'paragraph', text: 'アプリは特定の機能を有料（Proメンバーシップ）で提供する場合があり、決済と返金は各ストア（Google Playなど）のポリシーに従います。' },
        ],
      },
    ],
    effectiveDate: '施行日: 2026年4月22日',
  },

  zh: {
    title: '服务条款',
    sections: [
      {
        heading: '第1条（目的）',
        content: [
          { type: 'paragraph', text: '本条款旨在规定使用"LAON"（以下简称"应用"）提供的舞蹈反馈和协作服务的条件和程序。' },
        ],
      },
      {
        heading: '第2条（服务内容）',
        content: [
          { type: 'paragraph', text: '应用向用户提供以下服务。' },
          { type: 'list', items: [
            '创建和参与团队私人小队房间',
            '舞蹈视频上传和基于时间戳的反馈',
            '编舞编辑和分享工具',
            '团队日程协调和公告管理',
          ]},
        ],
      },
      {
        heading: '第3条（用户义务）',
        content: [
          { type: 'list', items: [
            '用户不得发布侵犯他人版权的内容。',
            '不当行为或违反社区准则可能导致服务使用受限。',
          ]},
        ],
      },
      {
        heading: '第4条（内容管理）',
        content: [
          { type: 'paragraph', text: '用户对自己上传的内容负责，应用提供举报和屏蔽功能处理不当内容。' },
        ],
      },
      {
        heading: '第5条（付费服务）',
        content: [
          { type: 'paragraph', text: '应用可能提供某些付费功能（Pro会员）。付款和退款遵循各应用商店（Google Play等）的政策。' },
        ],
      },
    ],
    effectiveDate: '生效日期：2026年4月22日',
  },

  th: {
    title: 'ข้อกำหนดการใช้บริการ',
    sections: [
      {
        heading: 'ข้อ 1 – วัตถุประสงค์',
        content: [
          { type: 'paragraph', text: "ข้อกำหนดเหล่านี้กำหนดเงื่อนไขและขั้นตอนสำหรับการใช้บริการฟีดแบ็กการเต้นและการทำงานร่วมกันที่ 'LAON' (ต่อไปนี้เรียกว่า 'แอป') ให้บริการ" },
        ],
      },
      {
        heading: 'ข้อ 2 – เนื้อหาบริการ',
        content: [
          { type: 'paragraph', text: 'แอปให้บริการต่อไปนี้แก่ผู้ใช้' },
          { type: 'list', items: [
            'การสร้างและเข้าร่วมห้องทีม crew ส่วนตัว',
            'การอัปโหลดวิดีโอการเต้นและฟีดแบ็กตามตำแหน่งเวลา',
            'เครื่องมือแก้ไขและแชร์ท่าเต้น',
            'การประสานตารางทีมและการจัดการประกาศ',
          ]},
        ],
      },
      {
        heading: 'ข้อ 3 – ข้อผูกพันของผู้ใช้',
        content: [
          { type: 'list', items: [
            'ผู้ใช้ต้องไม่โพสต์เนื้อหาที่ละเมิดลิขสิทธิ์ของผู้อื่น',
            'การใช้บริการอาจถูกจำกัดสำหรับพฤติกรรมที่ไม่เหมาะสมหรือการละเมิดแนวทางชุมชน',
          ]},
        ],
      },
      {
        heading: 'ข้อ 4 – การจัดการเนื้อหา',
        content: [
          { type: 'paragraph', text: 'ผู้ใช้รับผิดชอบต่อเนื้อหาที่อัปโหลด และแอปมีฟีเจอร์รายงานและบล็อกสำหรับเนื้อหาที่ไม่เหมาะสม' },
        ],
      },
      {
        heading: 'ข้อ 5 – บริการแบบชำระเงิน',
        content: [
          { type: 'paragraph', text: 'แอปอาจเสนอคุณสมบัติบางอย่างในรูปแบบชำระเงิน (สมาชิก Pro) การชำระเงินและการคืนเงินเป็นไปตามนโยบายของแต่ละร้านค้า (Google Play เป็นต้น)' },
        ],
      },
    ],
    effectiveDate: 'วันที่มีผลบังคับใช้: 22 เมษายน 2026',
  },
};
