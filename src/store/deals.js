export interface Deal {
  createdAt: string;
  updateAt: string;
  serviceId: string;
  userId: string;
  status: string;
  id: string;
  code: string;
  title: string;
  subtitle: string;
  currentStep: Number;
  steps: [
    {
      step: 1,
      title: "",
      subtitle: "",
      data: {},
      req: {},
      res: {},
      pinnedData: {
        puerto_reservado: true,
      },
    }
  ];
}

// deals []deal
// deal deal
