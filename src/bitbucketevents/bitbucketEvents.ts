export interface PrBody {
  pullrequest: {
    links: {
      self: {
        href: string;
      };
    };
  };
}

export interface ChangeRequestBody extends PrBody {
  changes_request: {
    user: {
      uuid: string;
    };
  };
}

export interface CommentBody extends PrBody {
  actor: {
    account_id: string;
  };
}

export interface ApprovalBody extends PrBody {
  approval: {
    user: {
      uuid: string;
    };
  };
}
